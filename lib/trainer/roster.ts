// The students assigned to the signed-in trainer.
//
// SCAFFOLD: SEED_ROSTER is an in-memory stand-in shaped like the real query
// (student profiles joined to their day submissions and weekend quiz scores,
// filtered by trainer assignment). Replace `loadAssignedStudents` with a
// Supabase read once the task schema lands; the components only depend on the
// types.

export const TEACHING_DAYS_PER_WEEK = 5;
export const TOTAL_DAYS = 60;

/** How a student closed out one teaching day of the current week. */
export type DayState = "done" | "late" | "missed" | "pending" | "upcoming";

export const DAY_STATE: Record<DayState, { dot: string; label: string }> = {
  done: { dot: "bg-positive", label: "submitted on time" },
  late: { dot: "bg-warning", label: "submitted late" },
  missed: { dot: "bg-destructive", label: "missed" },
  pending: {
    dot: "bg-primary-pale ring-1 ring-inset ring-border",
    label: "awaiting submission",
  },
  upcoming: { dot: "bg-secondary", label: "not released yet" },
};

export type AssignedStudent = {
  id: string;
  name: string;
  email: string;
  /** Week of the programme the student is currently in, 1..12. */
  week: number;
  /** Teaching days finished across the whole programme, 0..60. */
  daysCompleted: number;
  /** This week's five teaching days, Monday first. */
  weekDays: DayState[];
  /** Submissions sitting in this trainer's review queue. */
  pendingReview: number;
  /** Mean weekend assessment score, as a percentage. */
  quizAvg: number;
};

const SEED_ROSTER: AssignedStudent[] = [
  {
    id: "s1",
    name: "Aarav Sharma",
    email: "aarav@example.com",
    week: 9,
    // Three of week 9's five days are closed out, so 40 + 3. Matches the
    // student journey in lib/student/progress — Aarav is the seeded student.
    daysCompleted: 43,
    weekDays: ["done", "done", "done", "pending", "upcoming"],
    pendingReview: 2,
    quizAvg: 88,
  },
  {
    id: "s2",
    name: "Meera Iyer",
    email: "meera@example.com",
    week: 8,
    daysCompleted: 38,
    weekDays: ["done", "late", "done", "pending", "upcoming"],
    pendingReview: 3,
    quizAvg: 74,
  },
  {
    id: "s3",
    name: "Kenji Tanaka",
    email: "kenji@example.com",
    week: 5,
    daysCompleted: 21,
    weekDays: ["missed", "missed", "missed", "missed", "upcoming"],
    pendingReview: 0,
    quizAvg: 52,
  },
  {
    id: "s4",
    name: "Sofia Alvarez",
    email: "sofia@example.com",
    week: 2,
    daysCompleted: 7,
    weekDays: ["done", "done", "pending", "upcoming", "upcoming"],
    pendingReview: 3,
    quizAvg: 91,
  },
  {
    id: "s5",
    name: "Nadia Haq",
    email: "nadia@example.com",
    week: 11,
    daysCompleted: 55,
    weekDays: ["done", "done", "late", "done", "upcoming"],
    pendingReview: 1,
    quizAvg: 83,
  },
  {
    id: "s6",
    name: "Daniel Okoro",
    email: "daniel@example.com",
    week: 12,
    daysCompleted: 60,
    weekDays: ["done", "done", "done", "done", "done"],
    pendingReview: 0,
    quizAvg: 94,
  },
  {
    id: "s7",
    name: "Priya Nair",
    email: "priya@example.com",
    week: 2,
    daysCompleted: 6,
    weekDays: ["done", "missed", "late", "pending", "upcoming"],
    pendingReview: 4,
    quizAvg: 66,
  },
  {
    id: "s8",
    name: "Ibrahim Sesay",
    email: "ibrahim@example.com",
    week: 8,
    daysCompleted: 36,
    weekDays: ["late", "done", "pending", "upcoming", "upcoming"],
    pendingReview: 2,
    quizAvg: 71,
  },
];

/** The roster as it stands. Replace the body with a Supabase read. */
export function loadAssignedStudents(): AssignedStudent[] {
  return SEED_ROSTER;
}

/**
 * Why a student is worth looking at first. Order matters — missed days outrank
 * a weak average, and only the top reason is shown so the flag stays a single
 * glanceable badge rather than a stack.
 */
export function attentionReason(s: AssignedStudent): string | null {
  const missed = s.weekDays.filter((d) => d === "missed").length;
  if (missed >= 2) return `Missed ${missed} days this week`;
  if (s.quizAvg < 70) return `Quiz average ${s.quizAvg}%`;
  if (s.pendingReview >= 3) return `${s.pendingReview} tasks awaiting review`;
  return null;
}

/**
 * How loudly a flagged student should read on the dashboard. Missed days are a
 * retention risk (they stop showing up), a weak average is a teaching problem —
 * urgent, but not the same kind of urgent.
 */
export function attentionSeverity(s: AssignedStudent): "high" | "medium" {
  return s.weekDays.filter((d) => d === "missed").length >= 2 ? "high" : "medium";
}

/** Teaching days of the current week the student has closed out. */
export function daysDoneThisWeek(s: AssignedStudent): number {
  return s.weekDays.filter((d) => d === "done" || d === "late").length;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}
