// Quiz model — weekend papers authored by admins, sat by students.

/** Which weekend day a paper falls on, and what kind it is. */
export type QuizDay = "saturday" | "sunday";
export type QuizKind = "practice" | "assessment";
export type QuizAnswerMode = "single" | "multiple" | "true_false";

/** A question as the ADMIN authors it — includes the answer + explanation. */
export type QuizQuestion = {
  /** Stable id when editing an existing question; absent for a new one. */
  id?: string;
  prompt: string;
  options: string[];
  answerMode: QuizAnswerMode;
  /** One index for single-answer MCQ; one or more for multiple-answer MCQ. */
  correctIndices: number[];
  explanation: string;
};

/** A question as the STUDENT sees it while sitting — no answer leaked. */
export type StudentQuizQuestion = {
  id: string;
  prompt: string;
  options: string[];
  answerMode: QuizAnswerMode;
};

/** The admin's full view of a paper. */
export type AdminQuiz = {
  id: string;
  /** The course the paper's week belongs to — every lookup is course-scoped. */
  courseId: string;
  /** Carried alongside the id so the builder can link back without a re-read. */
  courseSlug: string;
  courseTitle: string;
  weekNumber: number;
  day: QuizDay;
  kind: QuizKind;
  title: string;
  /** Admin-allocated time for this assessment. */
  durationMinutes: number;
  status: "published" | "draft" | "empty";
  questions: QuizQuestion[];
};

/** Per-question verdict returned after marking. */
export type QuizReviewItem = {
  questionId: string;
  prompt: string;
  options: string[];
  answerMode: QuizAnswerMode;
  chosenIndices: number[];
  correctIndices: number[];
  explanation: string;
};

/** The marked result of an attempt. */
export type QuizAttemptResult = {
  score: number; // 0..100
  correctCount: number;
  total: number;
  review: QuizReviewItem[];
};
