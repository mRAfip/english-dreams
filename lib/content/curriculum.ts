import {
  QUIZZES_PER_WEEK,
  TEACHING_DAYS_PER_WEEK,
  type ContentStatus,
  type CurriculumDay,
  type CurriculumWeek,
} from "@/types/content";

// Pure helpers over an already-loaded course curriculum — no data of their own.
//
// This file used to hold `buildCurriculum()`, an in-memory 12-week scaffold that
// stood in for the content tables before they existed. Those tables are real
// now and every screen reads them through lib/content/queries.ts, so the
// scaffold is gone; what remains is the arithmetic that both the admin and the
// student side share.
//
// Everything here works on ONE course's weeks. Day and week numbers are
// positional within a course, so none of these functions mean anything without
// knowing which course's weeks were passed in.

/** Every content slot in a week: 5 days x 3 assets, plus the 2 quizzes. */
export function weekSlotCount(): number {
  return TEACHING_DAYS_PER_WEEK * 3 + QUIZZES_PER_WEEK;
}

/** How many of a week's slots are published — used for the week rail meter. */
export function publishedSlots(week: CurriculumWeek): number {
  const slots: ContentStatus[] = [
    ...week.days.flatMap((d) => [d.video.status, d.notes.status, d.task.status]),
    ...week.quizzes.map((q) => q.status),
  ];
  return slots.filter((s) => s === "published").length;
}

/** Teaching days in a course — 5 per week, however many weeks it has. */
export function teachingDayCount(weeks: CurriculumWeek[]): number {
  return weeks.length * TEACHING_DAYS_PER_WEEK;
}

/** The week a teaching day belongs to, within its course. 1-indexed. */
export function weekNumberForDay(dayNumber: number): number {
  return Math.floor((dayNumber - 1) / TEACHING_DAYS_PER_WEEK) + 1;
}

/** Look up one teaching day by its number, with the week it sits in. */
export function findDay(
  weeks: CurriculumWeek[],
  dayNumber: number,
): { day: CurriculumDay; week: CurriculumWeek } | null {
  const week = weeks[weekNumberForDay(dayNumber) - 1];
  const day = week?.days.find((d) => d.dayNumber === dayNumber);
  return week && day ? { day, week } : null;
}

/** How students engaged with one day's material. */
export type DayEngagement = {
  /** Students who have reached this day. */
  reached: number;
  videoViews: number;
  notesOpened: number;
  tasksCompleted: number;
};

/**
 * Scaffold engagement numbers. Deterministic from `dayNumber` — no randomness,
 * so server and client render identical values and the page can stay static.
 * Unpublished days report zeroes, since nobody can have seen them.
 */
export function dayEngagement(day: CurriculumDay): DayEngagement {
  const cohort = 42;
  if (day.video.status === "empty") {
    return { reached: 0, videoViews: 0, notesOpened: 0, tasksCompleted: 0 };
  }

  // Attrition: fewer students have reached the later days of the programme.
  const reached = Math.max(6, cohort - Math.floor(day.dayNumber * 0.4));
  const videoViews = Math.round(reached * 0.86);
  const notesOpened = Math.round(reached * 0.61);
  const tasksCompleted = Math.round(reached * 0.48);

  return { reached, videoViews, notesOpened, tasksCompleted };
}

/** Course-wide rollup for the editor header. */
export function curriculumStats(weeks: CurriculumWeek[]) {
  const published = weeks.reduce((sum, w) => sum + publishedSlots(w), 0);
  const total = weeks.length * weekSlotCount();
  return {
    published,
    total,
    percent: total === 0 ? 0 : Math.round((published / total) * 100),
  };
}
