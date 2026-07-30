// Quiz model — weekend papers authored by admins, sat by students.

/** Which weekend day a paper falls on, and what kind it is. */
export type QuizDay = "saturday" | "sunday";
export type QuizKind = "practice" | "assessment";

/** A question as the ADMIN authors it — includes the answer + explanation. */
export type QuizQuestion = {
  /** Stable id when editing an existing question; absent for a new one. */
  id?: string;
  prompt: string;
  options: string[];
  /** Index into `options`. */
  correctIndex: number;
  explanation: string;
};

/** A question as the STUDENT sees it while sitting — no answer leaked. */
export type StudentQuizQuestion = {
  id: string;
  prompt: string;
  options: string[];
};

/** The admin's full view of a paper. */
export type AdminQuiz = {
  id: string;
  weekNumber: number;
  day: QuizDay;
  kind: QuizKind;
  title: string;
  status: "published" | "draft" | "empty";
  questions: QuizQuestion[];
};

/** Per-question verdict returned after marking. */
export type QuizReviewItem = {
  questionId: string;
  prompt: string;
  options: string[];
  chosenIndex: number | null;
  correctIndex: number;
  explanation: string;
};

/** The marked result of an attempt. */
export type QuizAttemptResult = {
  score: number; // 0..100
  correctCount: number;
  total: number;
  review: QuizReviewItem[];
};
