import { getCourseById, getCurriculum } from "@/lib/content/queries";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/guards";
import { courseIdForStudent } from "@/lib/student/course";
import { TEACHING_DAYS_PER_WEEK } from "@/types/content";
import {
  buildJourney,
  type DayProgress,
  type QuizAttempt,
  type StudentJourney,
} from "@/lib/student/progress";

// Server-only loader for a student's journey. Kept separate from progress.ts
// (which stays client-safe: types + pure builders) because this pulls the live
// curriculum + per-student progress from Supabase via next/headers, which must
// never be bundled into a Client Component.
//
// A journey is always scoped to the student's assigned course — resolved first,
// then used for every read below.

type WeekEmb = { week_number: number; course_id: string };
type DayEmb = { weekday: number; content_weeks: WeekEmb | WeekEmb[] | null };
type ProgressRow = {
  video_watched: boolean;
  notes_downloaded: boolean;
  task_completed: boolean;
  watched_video_parts: string[] | null;
  updated_at: string;
  content_days: DayEmb | DayEmb[] | null;
};

/** Supabase types embedded to-one joins as arrays; take the single row. */
function one<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

/**
 * Read the student's progress rows, keyed by teaching-day number.
 *
 * Rows are kept only when the day belongs to `courseId`. A student moved
 * between courses still has rows pointing at their old course's days, and day
 * numbers repeat across courses — so "day 3 of Basic" would otherwise be read
 * as progress on day 3 of Intermediate. The old rows are kept in the table
 * (deleting them would destroy the history), just ignored here.
 *
 * The course check runs in JS rather than as a filter on the embedded week: a
 * mistyped embedded-filter path fails the whole query and silently returns an
 * empty progress map, which would read as "this student has done nothing".
 * One student's rows are few enough that filtering here costs nothing.
 */
async function loadProgress(
  userId: string,
  courseId: string,
): Promise<Map<number, DayProgress>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("student_day_progress")
    .select(
      "video_watched, notes_downloaded, task_completed, watched_video_parts, updated_at, content_days!inner(weekday, content_weeks!inner(week_number, course_id))",
    )
    .eq("user_id", userId);

  const map = new Map<number, DayProgress>();
  for (const row of (data ?? []) as unknown as ProgressRow[]) {
    const day = one(row.content_days);
    const week = one(day?.content_weeks);
    if (!day?.weekday || !week?.week_number) continue;
    if (week.course_id !== courseId) continue;
    const dayNumber = (week.week_number - 1) * TEACHING_DAYS_PER_WEEK + day.weekday;
    map.set(dayNumber, {
      videoWatched: row.video_watched,
      notesDownloaded: row.notes_downloaded,
      taskCompleted: row.task_completed,
      videoWatchedParts: row.watched_video_parts ?? [],
      updatedAt: row.updated_at,
    });
  }
  return map;
}

/**
 * Read the student's quiz attempts, keyed by content_quizzes id. Not filtered
 * by course: the map is looked up BY quiz id, and only the current course's
 * quiz ids are ever asked for, so foreign entries are inert.
 */
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

/**
 * The signed-in student's journey: their assigned course's curriculum plus
 * their own progress against it.
 *
 * A student with no course yet gets an empty journey (`course: null`). That is
 * a real state an admin can leave them in, so it returns cleanly rather than
 * throwing — the screens show a "your course hasn't been assigned yet" panel.
 */
export async function loadJourney(): Promise<StudentJourney> {
  const user = await getCurrentUser();
  if (!user) return buildJourney(null, []);

  const courseId = await courseIdForStudent(user.id);
  if (!courseId) return buildJourney(null, []);

  const [course, curriculum, progress, attempts] = await Promise.all([
    getCourseById(courseId),
    getCurriculum(courseId),
    loadProgress(user.id, courseId),
    loadAttempts(user.id),
  ]);

  return buildJourney(course, curriculum, progress, attempts);
}

/** A named student's journey, for staff screens. Empty when unassigned. */
export async function loadJourneyFor(
  studentId: string,
): Promise<StudentJourney> {
  const courseId = await courseIdForStudent(studentId);
  if (!courseId) return buildJourney(null, []);

  const [course, curriculum, progress, attempts] = await Promise.all([
    getCourseById(courseId),
    getCurriculum(courseId),
    loadProgress(studentId, courseId),
    loadAttempts(studentId),
  ]);

  return buildJourney(course, curriculum, progress, attempts);
}
