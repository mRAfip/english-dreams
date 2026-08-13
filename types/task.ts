import type { Role } from "@/types/role";

// The real daily-task model: typed questions authored by admins, student
// submissions (text + optional audio) and a trainer review thread.

export type TaskQuestionType =
  | "text"
  | "audio"
  | "editing"
  | "fill_blanks"
  | "comprehension";

export const QUESTION_TYPES: TaskQuestionType[] = [
  "text",
  "audio",
  "editing",
  "fill_blanks",
  "comprehension",
];

export const QUESTION_TYPE_LABEL: Record<TaskQuestionType, string> = {
  text: "Text answer",
  audio: "Audio answer",
  editing: "Find & fix mistakes",
  fill_blanks: "Fill in the blanks",
  comprehension: "Reading comprehension",
};

export type TaskFollowup = { id: string; position: number; prompt: string };

export type TaskQuestion = {
  id: string;
  position: number;
  type: TaskQuestionType;
  prompt: string;
  /** The reading passage — comprehension only. */
  passage: string | null;
  /** Comprehension follow-up questions. */
  followups: TaskFollowup[];
};

export type SubmissionStatus = "submitted" | "approved" | "redo";

export const STATUS_LABEL: Record<SubmissionStatus, string> = {
  submitted: "Awaiting review",
  approved: "Approved",
  redo: "Redo requested",
};

/** A resolved audio clip on an answer (serving URL). */
export type AnswerAudio = {
  url: string;
  name: string;
  durationMin: number | null;
};

/** A student's answer to a question, or to a comprehension follow-up. */
export type SubmissionAnswer = {
  id: string;
  questionId: string;
  followupId: string | null;
  text: string | null;
  audio: AnswerAudio | null;
  /** R2 key of the audio, so the student can resubmit it unchanged. */
  audioKey: string | null;
};

export type TaskSubmission = {
  id: string;
  status: SubmissionStatus;
  submittedAt: string;
  answers: SubmissionAnswer[];
};

export type ReviewComment = {
  id: string;
  authorId: string;
  authorName: string;
  authorRole: Role | null;
  body: string;
  createdAt: string;
  sentAt: string;
  questionId?: string | null;
};

/** A row in the trainer's review queue. */
export type ReviewQueueItem = {
  submissionId: string;
  dayNumber: number;
  studentId: string;
  studentName: string;
  studentAvatarUrl: string | null;
  taskTitle: string;
  status: SubmissionStatus;
  submittedAt: string;
  answerCount: number;
};

/** One answer as the student submits it (text and/or an uploaded audio key). */
export type AnswerInput = {
  questionId: string;
  followupId: string | null;
  text: string;
  audio: {
    key: string;
    name: string;
    contentType: string | null;
    durationMin: number | null;
  } | null;
};
