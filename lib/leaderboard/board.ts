import { createClient } from "@/lib/supabase/server";
import { getCurriculum } from "@/lib/content/queries";
import { rankEntries } from "@/lib/leaderboard/weekly";
import { WEEKEND_QUIZ_MAX, type WeeklyLeaderboard } from "@/types/leaderboard";

// Server-only loader for the admin weekly leaderboard. Reads the real students
// and their weekend-quiz attempts from Supabase, converts each paper's stored
// percentage into marks out of 25, and ranks the cohort with the shared
// rankEntries() logic (kept client-safe in ./weekly).
//
// A week appears on the board once it has at least one published weekend quiz.
// A student who didn't sit a paper scores "—" (null), not zero.

type Student = { id: string; name: string; avatarUrl: string | null };

/** Stored score is a 0..100 percentage; the board scores each paper out of 25. */
function toMarks(percent: number): number {
  return Math.round((percent / 100) * WEEKEND_QUIZ_MAX);
}

/** Every student in the cohort (id + display name + avatar). */
async function loadStudents(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<Student[]> {
  const { data: assigns } = await supabase
    .from("user_role_assignments")
    .select("user_id, user_roles!inner(name)")
    .eq("user_roles.name", "student");

  const ids = ((assigns ?? []) as { user_id: string }[]).map((a) => a.user_id);
  if (ids.length === 0) return [];

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, email, avatar_url")
    .in("id", ids);

  return ((profiles ?? []) as {
    id: string;
    full_name: string | null;
    email: string;
    avatar_url: string | null;
  }[]).map((p) => ({
    id: p.id,
    name: p.full_name || p.email,
    avatarUrl: p.avatar_url,
  }));
}

/** All weekly boards that have something to rank, newest week last. */
export async function loadAdminLeaderboard(): Promise<WeeklyLeaderboard[]> {
  const supabase = await createClient();
  const curriculum = await getCurriculum();

  // Weeks with at least one published, created weekend quiz.
  const weeks = curriculum.filter((w) =>
    w.quizzes.some((q) => q.status === "published" && q.quizId),
  );
  if (weeks.length === 0) return [];

  const students = await loadStudents(supabase);
  if (students.length === 0) {
    return weeks.map((w) => ({
      weekNumber: w.weekNumber,
      title: w.title,
      entries: [],
      viewer: null,
      participants: 0,
    }));
  }

  // One attempts query for every quiz on the board.
  const quizIds = weeks.flatMap((w) =>
    w.quizzes
      .filter((q) => q.quizId && q.status === "published")
      .map((q) => q.quizId as string),
  );
  const { data: attemptRows } = await supabase
    .from("student_quiz_attempts")
    .select("user_id, quiz_id, score")
    .in("quiz_id", quizIds);

  const scoreByUserQuiz = new Map<string, number>();
  for (const r of (attemptRows ?? []) as {
    user_id: string;
    quiz_id: string;
    score: number;
  }[]) {
    scoreByUserQuiz.set(`${r.user_id}:${r.quiz_id}`, r.score);
  }

  return weeks.map((week) => {
    const publishedQuizId = (day: "saturday" | "sunday") =>
      week.quizzes.find(
        (q) => q.day === day && q.status === "published" && q.quizId,
      )?.quizId ?? null;
    const satId = publishedQuizId("saturday");
    const sunId = publishedQuizId("sunday");

    const markFor = (studentId: string, quizId: string | null) => {
      if (!quizId) return null;
      const pct = scoreByUserQuiz.get(`${studentId}:${quizId}`);
      return pct === undefined ? null : toMarks(pct);
    };

    const entries = rankEntries(
      students.map((s) => ({
        studentId: s.id,
        name: s.name,
        avatarUrl: s.avatarUrl,
        isViewer: false,
        scores: {
          saturday: markFor(s.id, satId),
          sunday: markFor(s.id, sunId),
        },
      })),
    );

    return {
      weekNumber: week.weekNumber,
      title: week.title,
      entries,
      viewer: null,
      participants: entries.length,
    };
  });
}
