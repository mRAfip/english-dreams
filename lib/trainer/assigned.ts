import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth/guards";
import { getCurriculum } from "@/lib/content/queries";
import { TEACHING_DAYS_PER_WEEK } from "@/types/content";
import type { AssignedStudent, DayState } from "@/lib/trainer/roster";

// Server-only loader for the signed-in trainer's roster. Combines three tables:
//   student_trainer_assignments  → which students are mine
//   student_day_progress         → which teaching days each has completed
//   student_quiz_attempts        → their weekend quiz average
// against the published curriculum (which days are released).
//
// Kept separate from lib/trainer/roster (types + pure helpers, client-safe)
// because this reads via next/headers and must not reach a Client Component.
//
// Note: "late"/"missed"/pending-review states need submission timestamps and a
// review flow that don't exist yet, so days are just done / pending (released,
// not yet done) / upcoming (not released), and the review queue reads 0.

type Embedded<T> = T | T[] | null;
function one<T>(v: Embedded<T> | undefined): T | null {
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

/** The current 1..N week a student is working through, from days completed. */
function currentWeek(daysCompleted: number, totalWeeks: number): number {
  const w = Math.floor(daysCompleted / TEACHING_DAYS_PER_WEEK) + 1;
  return Math.min(Math.max(1, w), Math.max(1, totalWeeks));
}

export async function loadAssignedRoster(): Promise<AssignedStudent[]> {
  const user = await getCurrentUser();
  if (!user) return [];
  const supabase = await createClient();

  // 1. My assigned students.
  const { data: links } = await supabase
    .from("student_trainer_assignments")
    .select("student_id")
    .eq("trainer_id", user.id);
  const ids = ((links ?? []) as { student_id: string }[]).map(
    (l) => l.student_id,
  );
  if (ids.length === 0) return [];

  // 2. Profiles, progress, attempts, curriculum — in parallel.
  //    Profiles are read with the service role: profiles RLS only lets a user
  //    read their OWN row (or an admin read all), so a trainer can't read their
  //    students' names/emails through their own client. Safe here — `ids` are
  //    exactly this trainer's assigned students.
  const admin = createAdminClient();
  const [{ data: profiles }, { data: progress }, { data: attempts }, curriculum] =
    await Promise.all([
      admin.from("profiles").select("id, full_name, email").in("id", ids),
      supabase
        .from("student_day_progress")
        .select(
          "user_id, task_completed, content_days!inner(weekday, content_weeks!inner(week_number))",
        )
        .in("user_id", ids),
      supabase
        .from("student_quiz_attempts")
        .select("user_id, score")
        .in("user_id", ids),
      getCurriculum(),
    ]);

  const totalWeeks = curriculum.length;
  const releasedDays = new Set<number>();
  for (const week of curriculum) {
    for (const day of week.days) {
      if (
        day.video.status === "published" ||
        day.notes.status === "published" ||
        day.task.status === "published"
      ) {
        releasedDays.add(day.dayNumber);
      }
    }
  }

  // Completed teaching-day numbers per student.
  const completedByUser = new Map<string, Set<number>>();
  for (const row of (progress ?? []) as {
    user_id: string;
    task_completed: boolean;
    content_days: Embedded<{
      weekday: number;
      content_weeks: Embedded<{ week_number: number }>;
    }>;
  }[]) {
    if (!row.task_completed) continue;
    const day = one(row.content_days);
    const week = one(day?.content_weeks);
    if (!day?.weekday || !week?.week_number) continue;
    const dayNumber =
      (week.week_number - 1) * TEACHING_DAYS_PER_WEEK + day.weekday;
    const set = completedByUser.get(row.user_id) ?? new Set<number>();
    set.add(dayNumber);
    completedByUser.set(row.user_id, set);
  }

  // Quiz scores per student.
  const scoresByUser = new Map<string, number[]>();
  for (const a of (attempts ?? []) as { user_id: string; score: number }[]) {
    const arr = scoresByUser.get(a.user_id) ?? [];
    arr.push(a.score);
    scoresByUser.set(a.user_id, arr);
  }

  const profileById = new Map(
    ((profiles ?? []) as {
      id: string;
      full_name: string | null;
      email: string;
    }[]).map((p) => [p.id, p]),
  );

  return ids.map((id) => {
    const profile = profileById.get(id);
    const completed = completedByUser.get(id) ?? new Set<number>();
    const daysCompleted = completed.size;
    const week = currentWeek(daysCompleted, totalWeeks);

    // This week's five teaching days.
    const weekDays: DayState[] = Array.from(
      { length: TEACHING_DAYS_PER_WEEK },
      (_, i) => {
        const dayNumber = (week - 1) * TEACHING_DAYS_PER_WEEK + i + 1;
        if (completed.has(dayNumber)) return "done";
        if (releasedDays.has(dayNumber)) return "pending";
        return "upcoming";
      },
    );

    const scores = scoresByUser.get(id) ?? [];
    const quizAvg =
      scores.length === 0
        ? 0
        : Math.round(scores.reduce((s, n) => s + n, 0) / scores.length);

    return {
      id,
      name: profile?.full_name || profile?.email || "Student",
      email: profile?.email ?? "",
      week,
      daysCompleted,
      weekDays,
      pendingReview: 0, // review flow not built yet
      quizAvg,
    };
  });
}
