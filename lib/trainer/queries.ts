import { createClient } from "@/lib/supabase/server";
import { getCourseById, getCurriculum } from "@/lib/content/queries";
import {
  buildJourney,
  type DayProgress,
  type QuizAttempt,
} from "@/lib/student/progress";
import { courseIdsForStudents } from "@/lib/student/course";
import {
  type AssignedStudent,
  TEACHING_DAYS_PER_WEEK,
} from "@/lib/trainer/roster";
import { type Submission, type ReviewStatus } from "@/lib/tasks/review";
import type { Course, CurriculumWeek } from "@/types/content";

// A trainer's students are not all on the same course, so nothing here may load
// "the" curriculum. Each student's progress is built against THEIR course; the
// curricula are loaded once per distinct course and shared between the students
// on it.

type WeekEmb = { week_number: number; course_id: string };
type DayEmb = { weekday: number; content_weeks: WeekEmb | WeekEmb[] | null };
type ProgressRow = {
  user_id: string;
  video_watched: boolean;
  notes_downloaded: boolean;
  task_completed: boolean;
  watched_video_parts: string[] | null;
  content_days: DayEmb | DayEmb[] | null;
};

function one<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export async function loadAssignedStudents(
  trainerId: string,
): Promise<AssignedStudent[]> {
  const supabase = await createClient();

  // Get assigned students profiles
  const { data: assignments } = await supabase
    .from("student_trainer_assignments")
    .select(
      `
      student_id,
      profiles:student_id (
        full_name,
        email
      )
    `,
    )
    .eq("trainer_id", trainerId);

  let students = (assignments ?? []) as unknown as {
    student_id: string;
    profiles: { full_name: string | null; email: string } | null;
  }[];

  // Load all students who have submissions to ensure all active students are included
  const { data: subStudents } = await supabase
    .from("task_submissions")
    .select("student_id, profiles:student_id(full_name, email)");

  if (subStudents && subStudents.length > 0) {
    const uniqueMap = new Map<
      string,
      {
        student_id: string;
        profiles: { full_name: string | null; email: string } | null;
      }
    >();

    for (const s of students) {
      if (s.student_id) uniqueMap.set(s.student_id, s);
    }

    for (const item of subStudents as unknown as {
      student_id: string;
      profiles: { full_name: string | null; email: string } | null;
    }[]) {
      if (!uniqueMap.has(item.student_id)) {
        uniqueMap.set(item.student_id, item);
      }
    }
    students = Array.from(uniqueMap.values());
  }

  if (students.length === 0) return [];

  const studentIds = students.map((s) => s.student_id);

  // Load progress in bulk
  const { data: allProgress } = await supabase
    .from("student_day_progress")
    .select(
      "user_id, video_watched, notes_downloaded, task_completed, watched_video_parts, content_days!inner(weekday, content_weeks!inner(week_number, course_id))",
    )
    .in("user_id", studentIds);

  // Load quiz attempts in bulk
  const { data: allAttempts } = await supabase
    .from("student_quiz_attempts")
    .select("user_id, quiz_id, score")
    .in("user_id", studentIds);

  // Load submissions in bulk
  const { data: allSubmissions } = await supabase
    .from("task_submissions")
    .select("student_id, status")
    .in("student_id", studentIds);

  // Which course each student is on, so their rows can be filtered to it and
  // their journey built from the right curriculum.
  const courseByStudent = await courseIdsForStudents(studentIds);

  const progressMap = new Map<string, Map<number, DayProgress>>();
  const attemptsMap = new Map<string, Map<string, QuizAttempt>>();
  const pendingMap = new Map<string, number>();

  for (const id of studentIds) {
    progressMap.set(id, new Map());
    attemptsMap.set(id, new Map());
    pendingMap.set(id, 0);
  }

  for (const row of (allProgress ?? []) as unknown as ProgressRow[]) {
    const day = one(row.content_days);
    const week = one(day?.content_weeks);
    if (!day?.weekday || !week?.week_number) continue;
    // Skip rows from a course the student is no longer on — moving a student
    // keeps their old progress rows, but they don't count towards the new course.
    if (week.course_id !== courseByStudent.get(row.user_id)) continue;
    const dayNumber =
      (week.week_number - 1) * TEACHING_DAYS_PER_WEEK + day.weekday;
    progressMap.get(row.user_id)!.set(dayNumber, {
      videoWatched: row.video_watched,
      notesDownloaded: row.notes_downloaded,
      taskCompleted: row.task_completed,
      videoWatchedParts: row.watched_video_parts ?? [],
    });
  }

  for (const row of (allAttempts ?? []) as {
    user_id: string;
    quiz_id: string;
    score: number;
  }[]) {
    attemptsMap.get(row.user_id)!.set(row.quiz_id, { score: row.score });
  }

  for (const row of (allSubmissions ?? []) as {
    student_id: string;
    status: string;
  }[]) {
    if (row.status === "submitted") {
      pendingMap.set(row.student_id, (pendingMap.get(row.student_id) ?? 0) + 1);
    }
  }

  // One read per distinct course, not per student.
  const courseIds = [
    ...new Set(
      [...courseByStudent.values()].filter((id): id is string => !!id),
    ),
  ];
  const loaded = await Promise.all(
    courseIds.map(async (id) => {
      const [course, weeks] = await Promise.all([
        getCourseById(id),
        getCurriculum(id),
      ]);
      return [id, { course, weeks }] as const;
    }),
  );
  const byCourse = new Map<
    string,
    { course: Course | null; weeks: CurriculumWeek[] }
  >(loaded);

  return students.map((s) => {
    const courseId = courseByStudent.get(s.student_id) ?? null;
    const entry = courseId ? byCourse.get(courseId) : undefined;
    const journey = buildJourney(
      entry?.course ?? null,
      entry?.weeks ?? [],
      progressMap.get(s.student_id),
      attemptsMap.get(s.student_id),
    );
    const currentWeekData = journey.weeks[journey.currentWeek - 1];

    const weekDays = (currentWeekData?.days ?? []).map((day) => {
      if (day.state === "locked") return "upcoming" as const;
      if (day.task.state === "open") return "pending" as const;
      if (day.task.state === "submitted" || day.task.state === "reviewed") {
        return "done" as const;
      }
      if (day.task.state === "redo") return "pending" as const;
      return "missed" as const;
    });

    const scored = Array.from(attemptsMap.get(s.student_id)!.values());
    const quizAvg =
      scored.length === 0
        ? 0
        : Math.round(
            (scored.reduce((sum, q) => sum + q.score, 0) /
              (scored.length * 25)) *
              100,
          );

    return {
      id: s.student_id,
      name: s.profiles?.full_name ?? "Student",
      email: s.profiles?.email ?? "",
      courseTitle: entry?.course?.title ?? null,
      week: journey.currentWeek,
      daysCompleted: journey.daysCompleted,
      totalDays: journey.totalDays,
      weekDays,
      pendingReview: pendingMap.get(s.student_id) ?? 0,
      quizAvg,
    };
  });
}

export async function loadReviewQueue(
  trainerId: string,
): Promise<Submission[]> {
  const supabase = await createClient();

  // Get assigned students
  const { data: assignments } = await supabase
    .from("student_trainer_assignments")
    .select("student_id")
    .eq("trainer_id", trainerId);

  const assignedIds = (assignments ?? []).map((a) => a.student_id);

  // Load all students who have submissions to ensure unassigned active students are included
  const { data: subStudents } = await supabase
    .from("task_submissions")
    .select("student_id");

  const studentSet = new Set(assignedIds);
  if (subStudents) {
    for (const s of subStudents) {
      if (s.student_id) studentSet.add(s.student_id);
    }
  }
  const allStudentIds = Array.from(studentSet);

  const selectClause = `
    id,
    status,
    submitted_at,
    student_id,
    profiles:student_id (
      full_name,
      email
    ),
    content_days (
      weekday,
      task_title,
      task_prompt,
      content_weeks (
        week_number
      )
    )
  `;

  let submissions: any[] | null = null;

  if (allStudentIds.length > 0) {
    const { data } = await supabase
      .from("task_submissions")
      .select(selectClause)
      .in("student_id", allStudentIds)
      .order("submitted_at", { ascending: true });
    submissions = data;
  }

  // Fallback: If trainer has no assigned submissions or 0 submissions returned,
  // load all task submissions so home screen matches /trainer/review-tasks!
  if (!submissions || submissions.length === 0) {
    const { data } = await supabase
      .from("task_submissions")
      .select(selectClause)
      .order("submitted_at", { ascending: true });
    submissions = data;
  }

  const rows = (submissions ?? []) as unknown as {
    id: string;
    status: "submitted" | "approved" | "redo";
    submitted_at: string;
    student_id: string;
    profiles: { full_name: string | null; email: string } | null;
    content_days: {
      weekday: number;
      task_title: string;
      task_prompt: string;
      content_weeks: { week_number: number } | null;
    } | null;
  }[];

  if (rows.length === 0) return [];

  const subIds = rows.map((r) => r.id);

  // Get answers
  const { data: answerRows } = await supabase
    .from("submission_answers")
    .select(
      "id, submission_id, answer_text, audio_key, audio_name, audio_duration_min",
    )
    .in("submission_id", subIds);

  const answers = (answerRows ?? []) as {
    id: string;
    submission_id: string;
    answer_text: string | null;
    audio_key: string | null;
    audio_name: string | null;
    audio_duration_min: number | null;
  }[];

  const answersMap = new Map<string, typeof answers>();
  for (const a of answers) {
    if (!answersMap.has(a.submission_id)) {
      answersMap.set(a.submission_id, []);
    }
    answersMap.get(a.submission_id)!.push(a);
  }

  return rows.map((r) => {
    const day = r.content_days;
    const week = day?.content_weeks;
    const dayNumber =
      day && week
        ? (week.week_number - 1) * TEACHING_DAYS_PER_WEEK + day.weekday
        : 0;

    const subAnswers = answersMap.get(r.id) ?? [];
    const assets = subAnswers
      .filter((a) => a.audio_key)
      .map((a) => ({
        id: a.id,
        kind: "audio" as const,
        name: a.audio_name || "audio.m4a",
        meta: a.audio_duration_min ? `${a.audio_duration_min}m` : "audio",
        assetKey: a.audio_key,
      }));

    const hoursWaiting = Math.max(
      0,
      Math.floor(
        (Date.now() - new Date(r.submitted_at).getTime()) / (1000 * 60 * 60),
      ),
    );

    const statusMap: Record<typeof r.status, ReviewStatus> = {
      submitted: "pending",
      approved: "approved",
      redo: "redo",
    };

    return {
      id: r.id,
      studentId: r.student_id,
      studentName: r.profiles?.full_name ?? "Student",
      studentEmail: r.profiles?.email ?? "",
      dayNumber,
      taskTitle: day?.task_title || `Day ${dayNumber} task`,
      prompt: day?.task_prompt || "",
      submittedAt: formatRelativeTime(r.submitted_at),
      hoursWaiting,
      late: false,
      note: subAnswers
        .map((a) => a.answer_text)
        .filter(Boolean)
        .join("\n\n"),
      assets,
      status: statusMap[r.status],
      score: null,
      feedback: "",
    };
  });
}

function formatRelativeTime(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "Yesterday";
  return `${diffDays} days ago`;
}
