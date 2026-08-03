import { weekNumberForDay } from "@/lib/content/curriculum";

/** Where a submission sits in the trainer's workflow. */
export type ReviewStatus = "pending" | "approved" | "redo";

/** What the student attached. `assetKey` is the R2 object key once uploaded. */
export type SubmissionAsset = {
  id: string;
  kind: "audio" | "video" | "document" | "image";
  name: string;
  /** Human-readable size or runtime — whatever the kind makes sense of. */
  meta: string;
  assetKey: string | null;
};

export type Submission = {
  id: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  /** 1..60 — the teaching day this task belongs to. */
  dayNumber: number;
  taskTitle: string;
  /** The instruction the student was answering. */
  prompt: string;
  /** Display string; the real column is a timestamptz. */
  submittedAt: string;
  /** Hours the submission has been sitting unreviewed. Drives the SLA badge. */
  hoursWaiting: number;
  /** Whether the student missed the day's deadline. */
  late: boolean;
  /** The student's written answer. */
  note: string;
  assets: SubmissionAsset[];
  status: ReviewStatus;
  /** 0-100. Null until a trainer grades it. */
  score: number | null;
  feedback: string;
};



/** Week of the programme a submission belongs to, derived from its day. */
export function submissionWeek(s: Submission): number {
  return weekNumberForDay(s.dayNumber);
}

/**
 * How urgent an unreviewed submission is. The programme promises feedback
 * inside 48 hours, so that's where "overdue" starts; 24 is the warning shot.
 */
export function slaLevel(s: Submission): "fresh" | "due" | "overdue" {
  if (s.hoursWaiting >= 48) return "overdue";
  if (s.hoursWaiting >= 24) return "due";
  return "fresh";
}

/** "5h waiting" / "2d waiting" — compact enough for a list row. */
export function waitingLabel(hours: number): string {
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h waiting`;
  return `${Math.floor(hours / 24)}d waiting`;
}
