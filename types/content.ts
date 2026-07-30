// Curriculum model — the shape of the 60-day programme.
//
// Structure: 12 weeks x 7 days. The five weekdays are the numbered teaching
// days (dayNumber 1..60, matching the "Day n / 60" progress shown to students);
// the two weekend days carry quizzes instead and are NOT numbered, so a week
// contributes 5 to the day count and 2 to the quiz count.

/** How far along a piece of content is. Drives the badge in the admin UI. */
export type ContentStatus = "published" | "draft" | "empty";

/** One video part of a day's class. A day can have several, ordered by position. */
export type VideoPart = {
  /** content_day_videos row id. */
  id: string;
  /** 1..N order within the day. */
  position: number;
  /** Admin-set title; null falls back to "Part N". */
  title: string | null;
  /** Short description for context; null when unset. */
  description: string | null;
  /** Runtime in minutes. Null until probed. */
  durationMin: number | null;
  /** R2 object key. */
  assetKey: string;
  /** Optional thumbnail image R2 object key. */
  thumbnailKey: string | null;
  fileName: string | null;
  status: ContentStatus;
};

/**
 * The day's class as a whole — a SUMMARY over its video parts, kept so the
 * week-list publish logic and progress model stay simple. See `videos` for the
 * ordered parts a student actually watches.
 */
export type VideoClass = {
  title: string;
  /** Total runtime across all parts, or null when none are uploaded. */
  durationMin: number | null;
  /** True once at least one part exists (i.e. the day has a class). */
  assetKey: string | null;
  fileName: string | null;
  /** How many parts the day has. */
  partCount: number;
  status: ContentStatus;
};

/** Lesson notes handed out with the day's class. */
export type Notes = {
  title: string;
  /** R2 object key for the PDF. Null until uploaded. */
  assetKey: string | null;
  /** Original upload filename, for display. Null until uploaded. */
  fileName: string | null;
  status: ContentStatus;
};

/** The day's homework — now a set of typed questions (see types/task). */
export type DailyTask = {
  title: string;
  prompt: string;
  /** How many questions the task has. */
  questionCount: number;
  status: ContentStatus;
};

/** One numbered teaching day: a class (one or more video parts), notes, a task. */
export type CurriculumDay = {
  /** 1..60, unique across the whole programme. */
  dayNumber: number;
  /** 1..5 — position within its week. */
  weekday: number;
  title: string;
  /** Summary over the parts (has-a-class, total duration, count, status). */
  video: VideoClass;
  /** The ordered video parts a student watches. */
  videos: VideoPart[];
  notes: Notes;
  task: DailyTask;
};

/** A weekend quiz. Two per week: a practice run then the graded assessment. */
export type WeekendQuiz = {
  /** Stable slug for React keys, e.g. "w3-sat". */
  id: string;
  /** The content_quizzes row id, or null if the admin hasn't created it yet. */
  quizId: string | null;
  /** Which weekend day it falls on. */
  day: "saturday" | "sunday";
  title: string;
  kind: "practice" | "assessment";
  questionCount: number;
  status: ContentStatus;
};

/** One week of the programme: 5 teaching days + 2 weekend quizzes. */
export type CurriculumWeek = {
  /** 1..12. */
  weekNumber: number;
  title: string;
  /** One-line description of what the week covers. */
  focus: string;
  days: CurriculumDay[];
  quizzes: WeekendQuiz[];
};

export const WEEKS_IN_PROGRAMME = 12;
export const TEACHING_DAYS_PER_WEEK = 5;
export const QUIZZES_PER_WEEK = 2;
export const TOTAL_TEACHING_DAYS = WEEKS_IN_PROGRAMME * TEACHING_DAYS_PER_WEEK; // 60
