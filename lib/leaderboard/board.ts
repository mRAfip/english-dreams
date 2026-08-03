import { createClient } from "@/lib/supabase/server";
import { getCurriculum, listCourseOptions } from "@/lib/content/queries";
import { rankEntries } from "@/lib/leaderboard/weekly";
import { WEEKEND_QUIZ_MAX, type WeeklyLeaderboard } from "@/types/leaderboard";

// Server-only loader for the admin weekly leaderboard. Reads the real students
// and their weekend-quiz attempts from Supabase, converts each paper's stored
// percentage into marks out of 25, and ranks with the shared rankEntries().
//
// Boards are grouped by COURSE, then by week within it. Two students on
// different courses sit entirely different papers, so ranking them together
// would compare marks that were never comparable. A student only ever appears
// on their own course's boards.
//
// A course-week appears once it has at least one published weekend quiz. A
// student who didn't sit a paper scores "—" (null), not zero.

type Student = {
  id: string;
  name: string;
  avatarUrl: string | null;
  /** The course they're assigned to. Null = unassigned, so they rank nowhere. */
  courseId: string | null;
};

/** Stored score is a 0..100 percentage; the board scores each paper out of 25. */
function toMarks(percent: number): number {
  return Math.round((percent / 100) * WEEKEND_QUIZ_MAX);
}

/** Every student (id + display name + avatar + assigned course). */
async function loadStudents(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<Student[]> {
  const { data: assigns } = await supabase
    .from("user_role_assignments")
    .select("user_id, user_roles!inner(name)")
    .eq("user_roles.name", "student");

  const ids = ((assigns ?? []) as { user_id: string }[]).map((a) => a.user_id);
  if (ids.length === 0) return [];

  const [{ data: profiles }, { data: access }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, email, avatar_url")
      .in("id", ids),
    supabase
      .from("student_access")
      .select("student_id, course_id")
      .in("student_id", ids),
  ]);

  const courseByStudent = new Map<string, string | null>();
  for (const a of (access ?? []) as {
    student_id: string;
    course_id: string | null;
  }[]) {
    courseByStudent.set(a.student_id, a.course_id);
  }

  return ((profiles ?? []) as {
    id: string;
    full_name: string | null;
    email: string;
    avatar_url: string | null;
  }[]).map((p) => ({
    id: p.id,
    name: p.full_name || p.email,
    avatarUrl: p.avatar_url,
    courseId: courseByStudent.get(p.id) ?? null,
  }));
}

/**
 * Every course-week that has something to rank, ordered by course then week.
 * A course with no published weekend quiz contributes no boards.
 */
export async function loadAdminLeaderboard(): Promise<WeeklyLeaderboard[]> {
  const supabase = await createClient();
  const [courses, students] = await Promise.all([
    listCourseOptions(),
    loadStudents(supabase),
  ]);
  if (courses.length === 0) return [];

  // One attempts read for the whole page; sliced per course-week below.
  const { data: attemptRows } = await supabase
    .from("student_quiz_attempts")
    .select("user_id, quiz_id, score");
  const scoreByUserQuiz = new Map<string, number>();
  for (const r of (attemptRows ?? []) as {
    user_id: string;
    quiz_id: string;
    score: number;
  }[]) {
    scoreByUserQuiz.set(`${r.user_id}:${r.quiz_id}`, r.score);
  }

  const curriculums = await Promise.all(
    courses.map((course) => getCurriculum(course.id)),
  );

  const boards: WeeklyLeaderboard[] = [];

  courses.forEach((course, i) => {
    const cohort = students.filter((s) => s.courseId === course.id);

    // Weeks with at least one published, created weekend quiz.
    const weeks = curriculums[i].filter((w) =>
      w.quizzes.some((q) => q.status === "published" && q.quizId),
    );

    for (const week of weeks) {
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

      // A week's board ranks only the students who have reached it — i.e. sat
      // at least one of its two papers. A student who hasn't taken either isn't
      // "behind", they simply aren't competing at this level yet, so they're
      // left off entirely rather than shown as a zero. Their row appears the
      // moment they sit their first paper, and grows as they sit the second.
      const rows = cohort
        .map((s) => ({
          studentId: s.id,
          name: s.name,
          avatarUrl: s.avatarUrl,
          isViewer: false,
          scores: {
            saturday: markFor(s.id, satId),
            sunday: markFor(s.id, sunId),
          },
        }))
        .filter((r) => r.scores.saturday !== null || r.scores.sunday !== null);

      const entries = rankEntries(rows);

      boards.push({
        courseId: course.id,
        courseTitle: course.title,
        weekNumber: week.weekNumber,
        title: week.title,
        entries,
        viewer: null,
        participants: entries.length,
      });
    }
  });

  return boards;
}
