import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { participantInfo } from "@/lib/inbox/participants";
import { formatMessageTime } from "@/lib/inbox/format";
import { TEACHING_DAYS_PER_WEEK } from "@/types/content";
import type {
  ReviewComment,
  ReviewQueueItem,
  SubmissionAnswer,
  SubmissionStatus,
  TaskQuestion,
  TaskQuestionType,
  TaskSubmission,
} from "@/types/task";

// Server-only reads for the daily-task feature.

/** content_days.id for a 1..60 day number, or null. */
export async function resolveDayId(
  supabase: SupabaseClient,
  dayNumber: number,
): Promise<string | null> {
  const weekNumber = Math.floor((dayNumber - 1) / TEACHING_DAYS_PER_WEEK) + 1;
  const weekday = ((dayNumber - 1) % TEACHING_DAYS_PER_WEEK) + 1;
  const { data: week } = await supabase
    .from("content_weeks")
    .select("id")
    .eq("week_number", weekNumber)
    .maybeSingle();
  if (!week) return null;
  const { data: day } = await supabase
    .from("content_days")
    .select("id")
    .eq("week_id", (week as { id: string }).id)
    .eq("weekday", weekday)
    .maybeSingle();
  return (day as { id: string } | null)?.id ?? null;
}

type QuestionRow = {
  id: string;
  position: number;
  type: TaskQuestionType;
  prompt: string;
  passage: string | null;
  task_question_followups: { id: string; position: number; prompt: string }[] | null;
};

function mapQuestion(q: QuestionRow): TaskQuestion {
  return {
    id: q.id,
    position: q.position,
    type: q.type,
    prompt: q.prompt,
    passage: q.passage,
    followups: (q.task_question_followups ?? [])
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((f) => ({ id: f.id, position: f.position, prompt: f.prompt })),
  };
}

/** The day's authored questions (with comprehension follow-ups), ordered. */
export async function getTaskQuestions(dayNumber: number): Promise<TaskQuestion[]> {
  const supabase = await createClient();
  const dayId = await resolveDayId(supabase, dayNumber);
  if (!dayId) return [];

  const { data } = await supabase
    .from("task_questions")
    .select(
      "id, position, type, prompt, passage, task_question_followups(id, position, prompt)",
    )
    .eq("day_id", dayId)
    .order("position", { ascending: true });

  return ((data ?? []) as QuestionRow[]).map(mapQuestion);
}

type AnswerRow = {
  id: string;
  question_id: string;
  followup_id: string | null;
  answer_text: string | null;
  audio_key: string | null;
  audio_name: string | null;
  audio_duration_min: number | null;
};

function mapAnswer(a: AnswerRow): SubmissionAnswer {
  return {
    id: a.id,
    questionId: a.question_id,
    followupId: a.followup_id,
    text: a.answer_text,
    audio: a.audio_key
      ? {
          url: `/api/submission-audio/${a.id}`,
          name: a.audio_name ?? "voice answer",
          durationMin: a.audio_duration_min,
        }
      : null,
    audioKey: a.audio_key,
  };
}

/** The student's submission for a day (their own, or a staff view), or null. */
export async function getSubmission(
  dayNumber: number,
  studentId: string,
): Promise<TaskSubmission | null> {
  const supabase = await createClient();
  const dayId = await resolveDayId(supabase, dayNumber);
  if (!dayId) return null;

  const { data: sub } = await supabase
    .from("task_submissions")
    .select("id, status, submitted_at")
    .eq("day_id", dayId)
    .eq("student_id", studentId)
    .maybeSingle();
  if (!sub) return null;

  const s = sub as { id: string; status: SubmissionStatus; submitted_at: string };
  const { data: answers } = await supabase
    .from("submission_answers")
    .select(
      "id, question_id, followup_id, answer_text, audio_key, audio_name, audio_duration_min",
    )
    .eq("submission_id", s.id);

  return {
    id: s.id,
    status: s.status,
    submittedAt: formatMessageTime(s.submitted_at),
    answers: ((answers ?? []) as AnswerRow[]).map(mapAnswer),
  };
}

type QueueRow = {
  id: string;
  student_id: string;
  status: SubmissionStatus;
  submitted_at: string;
  content_days: {
    weekday: number;
    task_title: string;
    content_weeks: { week_number: number } | null;
  } | null;
};

/** The signed-in trainer's review queue — their students' submissions. */
export async function getReviewQueue(): Promise<ReviewQueueItem[]> {
  const supabase = await createClient();

  // RLS scopes this to the trainer's own assigned students (is_student_staff).
  const { data } = await supabase
    .from("task_submissions")
    .select(
      "id, student_id, status, submitted_at, content_days!inner(weekday, task_title, content_weeks!inner(week_number))",
    )
    .order("submitted_at", { ascending: true });
  const rows = (data ?? []) as unknown as QueueRow[];
  if (rows.length === 0) return [];

  const info = await participantInfo([...new Set(rows.map((r) => r.student_id))]);

  // Answer counts per submission.
  const ids = rows.map((r) => r.id);
  const { data: answerRows } = await supabase
    .from("submission_answers")
    .select("submission_id")
    .in("submission_id", ids);
  const counts = new Map<string, number>();
  for (const a of (answerRows ?? []) as { submission_id: string }[]) {
    counts.set(a.submission_id, (counts.get(a.submission_id) ?? 0) + 1);
  }

  return rows
    .map((r) => {
      const day = r.content_days;
      const week = day?.content_weeks;
      const dayNumber =
        day && week
          ? (week.week_number - 1) * TEACHING_DAYS_PER_WEEK + day.weekday
          : 0;
      const i = info.get(r.student_id);
      return {
        submissionId: r.id,
        dayNumber,
        studentId: r.student_id,
        studentName: i?.name ?? "Student",
        studentAvatarUrl: i?.avatarUrl ?? null,
        taskTitle: day?.task_title || `Day ${dayNumber} task`,
        status: r.status,
        submittedAt: formatMessageTime(r.submitted_at),
        answerCount: counts.get(r.id) ?? 0,
      } satisfies ReviewQueueItem;
    })
    // Pending first, then approved/redo; newest submitted last so the oldest
    // waiting rises to the top.
    .sort((a, b) => rank(a.status) - rank(b.status));
}

function rank(status: SubmissionStatus): number {
  return status === "submitted" ? 0 : status === "redo" ? 1 : 2;
}

/** Full submission for the review detail: questions + answers + student + meta. */
export async function getReviewSubmission(submissionId: string): Promise<{
  submissionId: string;
  dayNumber: number;
  taskTitle: string;
  status: SubmissionStatus;
  studentId: string;
  studentName: string;
  questions: TaskQuestion[];
  answers: SubmissionAnswer[];
} | null> {
  const supabase = await createClient();

  const { data: sub } = await supabase
    .from("task_submissions")
    .select(
      "id, student_id, status, day_id, content_days!inner(weekday, task_title, content_weeks!inner(week_number))",
    )
    .eq("id", submissionId)
    .maybeSingle();
  if (!sub) return null;

  const s = sub as unknown as {
    id: string;
    student_id: string;
    status: SubmissionStatus;
    day_id: string;
    content_days: {
      weekday: number;
      task_title: string;
      content_weeks: { week_number: number } | null;
    } | null;
  };
  const day = s.content_days;
  const week = day?.content_weeks;
  const dayNumber =
    day && week
      ? (week.week_number - 1) * TEACHING_DAYS_PER_WEEK + day.weekday
      : 0;

  const [{ data: questions }, { data: answers }, info] = await Promise.all([
    supabase
      .from("task_questions")
      .select(
        "id, position, type, prompt, passage, task_question_followups(id, position, prompt)",
      )
      .eq("day_id", s.day_id)
      .order("position", { ascending: true }),
    supabase
      .from("submission_answers")
      .select(
        "id, question_id, followup_id, answer_text, audio_key, audio_name, audio_duration_min",
      )
      .eq("submission_id", s.id),
    participantInfo([s.student_id]),
  ]);

  return {
    submissionId: s.id,
    dayNumber,
    taskTitle: day?.task_title || `Day ${dayNumber} task`,
    status: s.status,
    studentId: s.student_id,
    studentName: info.get(s.student_id)?.name ?? "Student",
    questions: ((questions ?? []) as QuestionRow[]).map(mapQuestion),
    answers: ((answers ?? []) as AnswerRow[]).map(mapAnswer),
  };
}

/** The review comment thread for a submission, oldest first, with author names. */
export async function getReviewComments(
  submissionId: string,
): Promise<ReviewComment[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("task_review_comments")
    .select("id, author_id, body, created_at")
    .eq("submission_id", submissionId)
    .order("created_at", { ascending: true });
  const rows = (data ?? []) as {
    id: string;
    author_id: string | null;
    body: string;
    created_at: string;
  }[];
  if (rows.length === 0) return [];

  const info = await participantInfo(
    [...new Set(rows.map((r) => r.author_id).filter((x): x is string => !!x))],
  );

  return rows.map((r) => {
    const i = r.author_id ? info.get(r.author_id) : undefined;
    return {
      id: r.id,
      authorId: r.author_id ?? "",
      authorName: i?.name ?? "Unknown",
      authorRole: i?.role ?? null,
      body: r.body,
      createdAt: r.created_at,
      sentAt: formatMessageTime(r.created_at),
    };
  });
}
