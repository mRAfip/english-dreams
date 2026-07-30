// Weekly leaderboard model.
//
// A week's ranking comes from its two weekend quizzes ONLY — the Saturday
// practice and the Sunday assessment (see types/content.ts). Weekday tasks and
// class attendance do not score. Each paper is worth 25 marks, so a student's
// weekly score is the SUM of the two papers, out of 50. A quiz that was never
// attempted contributes 0 but is rendered as "—" rather than a zero, since
// missing and failing are different stories.

import { QUIZZES_PER_WEEK } from "@/types/content";

/** Marks out of which each weekend quiz is scored. */
export const WEEKEND_QUIZ_MAX = 25;

/** Best possible weekly score: both weekend papers at full marks. */
export const WEEKLY_MAX_SCORE = WEEKEND_QUIZ_MAX * QUIZZES_PER_WEEK; // 50

/** One student's marks for a single week. `null` = quiz not attempted. */
export type WeekendScores = {
  saturday: number | null;
  sunday: number | null;
};

/** A ranked row on the weekly board. */
export type LeaderboardEntry = {
  studentId: string;
  name: string;
  avatarUrl: string | null;
  scores: WeekendScores;
  /** saturday + sunday, unattempted counted as 0. */
  total: number;
  /** How many of the two papers were submitted. 0, 1 or 2. */
  attempted: number;
  /** Competition rank — ties share a rank and the next rank skips. */
  rank: number;
  /** True for the signed-in student's own row. Always false for staff. */
  isViewer: boolean;
};

/** The whole board for one week. */
export type WeeklyLeaderboard = {
  weekNumber: number;
  /** Week theme from the curriculum, e.g. "Foundations". */
  title: string;
  entries: LeaderboardEntry[];
  /** The viewer's row, hoisted out so the summary strip doesn't hunt for it. */
  viewer: LeaderboardEntry | null;
  /** Rows on the board — the denominator in "3rd of 15". */
  participants: number;
};

/**
 * A row on a trainer's board. Carries BOTH standings: where the student sits
 * among that trainer's own students, and where they sit in the whole cohort.
 * The two disagree often — a trainer's best student can still be 6th overall —
 * and hiding the second would tell the trainer a flattering lie.
 */
export type TrainerLeaderboardEntry = LeaderboardEntry & {
  /** Rank among this trainer's assigned students only. Ties behave as above. */
  groupRank: number;
  /** Rank across every student in the cohort — `LeaderboardEntry.rank`. */
  cohortRank: number;
};

/** One week of a trainer's board, scoped to their assigned students. */
export type TrainerLeaderboard = {
  weekNumber: number;
  title: string;
  /** Sorted by groupRank. */
  entries: TrainerLeaderboardEntry[];
  /** Rows on this board — the denominator in "3rd of 7". */
  assigned: number;
  /** Every student ranked cohort-wide — the denominator in "6th of 14". */
  cohortSize: number;
};

/** Rollup across a board — the admin header numbers. */
export type LeaderboardStats = {
  topScore: number;
  /** Mean weekly total, rounded. Unattempted papers drag it down, as they should. */
  average: number;
  /** Students who sat both papers. */
  bothAttempted: number;
  /** Students who sat neither. */
  noneAttempted: number;
};
