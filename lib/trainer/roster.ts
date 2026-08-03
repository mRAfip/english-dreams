

export const TEACHING_DAYS_PER_WEEK = 5;

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
  /** The course they're on. Null when the admin hasn't assigned one yet. */
  courseTitle: string | null;
  /** Week of their course the student is currently in. */
  week: number;
  /** Teaching days finished, out of however many their course has. */
  daysCompleted: number;
  /** Teaching days their course has been authored to. 0 when unassigned. */
  totalDays: number;
  /** This week's five teaching days, Monday first. */
  weekDays: DayState[];
  /** Submissions sitting in this trainer's review queue. */
  pendingReview: number;
  /** Mean weekend assessment score, as a percentage. */
  quizAvg: number;
};





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
