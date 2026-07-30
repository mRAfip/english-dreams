import { weekNumberForDay } from "@/lib/content/curriculum";

// The trainer review queue — one submitted daily task per row.
//
// SCAFFOLD: SEED_SUBMISSIONS is an in-memory stand-in shaped like the real
// query (task_submissions joined to profiles and the day's task), so the UI can
// be built against the final shape. Replace `loadReviewQueue` with a Supabase
// read once the task schema lands; the components only depend on the types.

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

const SEED_SUBMISSIONS: Submission[] = [
  {
    id: "t1",
    studentId: "s7",
    studentName: "Priya Nair",
    studentEmail: "priya@example.com",
    dayNumber: 8,
    taskTitle: "Introduce yourself in the past tense",
    prompt:
      "Record a 2-minute answer describing what you did last weekend. Use at least five past-tense verbs and one time marker.",
    submittedAt: "Today, 09:12",
    hoursWaiting: 5,
    late: false,
    note: "I talked about visiting my grandmother. The past tense of 'go' still confuses me — I said 'goed' once and corrected it.",
    assets: [
      { id: "a1", kind: "audio", name: "day-08-answer.m4a", meta: "2:04", assetKey: null },
    ],
    status: "pending",
    score: null,
    feedback: "",
  },
  {
    id: "t2",
    studentId: "s4",
    studentName: "Sofia Alvarez",
    studentEmail: "sofia@example.com",
    dayNumber: 7,
    taskTitle: "Write five questions for a stranger",
    prompt:
      "Write five open questions you could ask someone you just met. Avoid yes/no forms.",
    submittedAt: "Today, 08:40",
    hoursWaiting: 6,
    late: false,
    note: "Where did you grow up? What made you move here? How do you spend your weekends? Who taught you to cook? Why did you choose this course?",
    assets: [
      { id: "a2", kind: "document", name: "day-07-questions.pdf", meta: "1 page", assetKey: null },
    ],
    status: "pending",
    score: null,
    feedback: "",
  },
  {
    id: "t3",
    studentId: "s2",
    studentName: "Meera Iyer",
    studentEmail: "meera@example.com",
    dayNumber: 37,
    taskTitle: "Summarise a news article",
    prompt:
      "Read any English news article and summarise it in 150 words, then record yourself reading the summary aloud.",
    submittedAt: "Yesterday, 21:58",
    hoursWaiting: 17,
    late: true,
    note: "Summary of an article about solar farms in Rajasthan. I found the numbers hard to say aloud.",
    assets: [
      { id: "a3", kind: "document", name: "day-37-summary.pdf", meta: "1 page", assetKey: null },
      { id: "a4", kind: "audio", name: "day-37-reading.m4a", meta: "1:38", assetKey: null },
    ],
    status: "pending",
    score: null,
    feedback: "",
  },
  {
    id: "t4",
    studentId: "s1",
    studentName: "Aarav Sharma",
    studentEmail: "aarav@example.com",
    dayNumber: 42,
    taskTitle: "Disagree politely",
    prompt:
      "Record a 90-second response disagreeing with the statement 'remote work is better for everyone'. Use three hedging phrases.",
    submittedAt: "Yesterday, 19:05",
    hoursWaiting: 19,
    late: false,
    note: "I used 'I see your point, but', 'that may be true for some' and 'I'm not entirely convinced'.",
    assets: [
      { id: "a5", kind: "audio", name: "day-42-disagree.m4a", meta: "1:31", assetKey: null },
    ],
    status: "pending",
    score: null,
    feedback: "",
  },
  {
    id: "t5",
    studentId: "s8",
    studentName: "Ibrahim Sesay",
    studentEmail: "ibrahim@example.com",
    dayNumber: 36,
    taskTitle: "Describe a photograph",
    prompt:
      "Pick any photograph and describe it for two minutes without naming the objects directly.",
    submittedAt: "2 days ago, 11:22",
    hoursWaiting: 51,
    late: true,
    note: "I described a street market photo from my phone.",
    assets: [
      { id: "a6", kind: "image", name: "market.jpg", meta: "1.2 MB", assetKey: null },
      { id: "a7", kind: "audio", name: "day-36-describe.m4a", meta: "2:11", assetKey: null },
    ],
    status: "pending",
    score: null,
    feedback: "",
  },
  {
    id: "t6",
    studentId: "s5",
    studentName: "Nadia Haq",
    studentEmail: "nadia@example.com",
    dayNumber: 54,
    taskTitle: "Mock interview answer",
    prompt:
      "Answer 'tell me about a time you handled a difficult customer' using the STAR structure.",
    submittedAt: "2 days ago, 08:15",
    hoursWaiting: 54,
    late: false,
    note: "Situation, task, action, result — I timed myself at just under three minutes.",
    assets: [
      { id: "a8", kind: "video", name: "day-54-interview.mp4", meta: "2:47", assetKey: null },
    ],
    status: "pending",
    score: null,
    feedback: "",
  },
  {
    id: "t7",
    studentId: "s6",
    studentName: "Daniel Okoro",
    studentEmail: "daniel@example.com",
    dayNumber: 60,
    taskTitle: "Final reflection",
    prompt: "Record a five-minute reflection on the whole programme.",
    submittedAt: "3 days ago, 16:40",
    hoursWaiting: 0,
    late: false,
    note: "Talked through what changed for me between week 1 and week 12.",
    assets: [
      { id: "a9", kind: "video", name: "day-60-reflection.mp4", meta: "5:12", assetKey: null },
    ],
    status: "approved",
    score: 94,
    feedback:
      "Excellent range and almost no hesitation. Watch the /θ/ sound in 'through' — otherwise this is interview-ready.",
  },
  {
    id: "t8",
    studentId: "s3",
    studentName: "Kenji Tanaka",
    studentEmail: "kenji@example.com",
    dayNumber: 21,
    taskTitle: "Order a meal by phone",
    prompt: "Role-play ordering a takeaway. Include a change of mind mid-order.",
    submittedAt: "5 days ago, 10:02",
    hoursWaiting: 0,
    late: true,
    note: "Recorded twice, the first one cut off.",
    assets: [
      { id: "a10", kind: "audio", name: "day-21-order.m4a", meta: "1:12", assetKey: null },
    ],
    status: "redo",
    score: 48,
    feedback:
      "The order itself was clear, but there's no change of mind in the recording — that was the point of the task. Please redo with that part included.",
  },
  {
    id: "t9",
    studentId: "s2",
    studentName: "Meera Iyer",
    studentEmail: "meera@example.com",
    dayNumber: 36,
    taskTitle: "Describe a photograph",
    prompt:
      "Pick any photograph and describe it for two minutes without naming the objects directly.",
    submittedAt: "4 days ago, 20:31",
    hoursWaiting: 0,
    late: false,
    note: "Described a photo of my old school.",
    assets: [
      { id: "a11", kind: "audio", name: "day-36-describe.m4a", meta: "2:02", assetKey: null },
    ],
    status: "approved",
    score: 79,
    feedback: "Good detail. Try slowing down when you list things — the endings blur.",
  },
];

/** The queue as it stands. Replace the body with a Supabase read. */
export function loadReviewQueue(): Submission[] {
  return SEED_SUBMISSIONS;
}

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
