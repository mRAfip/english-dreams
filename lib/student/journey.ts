import { getCurriculum } from "@/lib/content/queries";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/guards";
import { TEACHING_DAYS_PER_WEEK } from "@/types/content";
import {
  buildJourney,
  type DayProgress,
  type QuizAttempt,
  type StudentJourney,
} from "@/lib/student/progress";

// Server-only loader for the signed-in student's journey. Kept separate from
// progress.ts (which stays client-safe: types + pure builders) because this
// pulls the live curriculum + per-student progress from Supabase via
// next/headers, which must never be bundled into a Client Component.

type WeekEmb = { week_number: number };
type DayEmb = { weekday: number; content_weeks: WeekEmb | WeekEmb[] | null };
type ProgressRow = {
  video_watched: boolean;
  notes_downloaded: boolean;
  task_completed: boolean;
  watched_video_parts: string[] | null;
  content_days: DayEmb | DayEmb[] | null;
};

/** Supabase types embedded to-one joins as arrays; take the single row. */
function one<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

/** Read the student's progress rows, keyed by global teaching-day number. */
async function loadProgress(userId: string): Promise<Map<number, DayProgress>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("student_day_progress")
    .select(
      "video_watched, notes_downloaded, task_completed, watched_video_parts, content_days!inner(weekday, content_weeks!inner(week_number))",
    )
    .eq("user_id", userId);

  const map = new Map<number, DayProgress>();
  for (const row of (data ?? []) as unknown as ProgressRow[]) {
    const day = one(row.content_days);
    const week = one(day?.content_weeks);
    if (!day?.weekday || !week?.week_number) continue;
    const dayNumber = (week.week_number - 1) * TEACHING_DAYS_PER_WEEK + day.weekday;
    map.set(dayNumber, {
      videoWatched: row.video_watched,
      notesDownloaded: row.notes_downloaded,
      taskCompleted: row.task_completed,
      videoWatchedParts: row.watched_video_parts ?? [],
    });
  }
  return map;
}

/** Read the student's quiz attempts, keyed by content_quizzes id. */
async function loadAttempts(userId: string): Promise<Map<string, QuizAttempt>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("student_quiz_attempts")
    .select("quiz_id, score")
    .eq("user_id", userId);

  const map = new Map<string, QuizAttempt>();
  for (const row of (data ?? []) as { quiz_id: string; score: number }[]) {
    map.set(row.quiz_id, { score: row.score });
  }
  return map;
}

/** The student's journey, built from the content tables + their progress. */
export async function loadJourney(): Promise<StudentJourney> {
  const user = await getCurrentUser();
  const [curriculum, progress, attempts] = await Promise.all([
    getCurriculum(),
    user ? loadProgress(user.id) : Promise.resolve(new Map<number, DayProgress>()),
    user ? loadAttempts(user.id) : Promise.resolve(new Map<string, QuizAttempt>()),
  ]);
  return buildJourney(curriculum, progress, attempts);
}
