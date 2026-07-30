import { buildCurriculum } from "@/lib/content/curriculum";
import type { CurriculumWeek } from "@/types/content";
import {
  WEEKEND_QUIZ_MAX,
  type LeaderboardEntry,
  type LeaderboardStats,
  type TrainerLeaderboard,
  type WeeklyLeaderboard,
  type WeekendScores,
} from "@/types/leaderboard";

// Weekly leaderboard — ranks students by the sum of a week's two weekend
// quizzes. Shared by the admin, trainer and student boards; only the framing
// around it differs (admin sees every cohort, a student sees their own row
// highlighted).
//
// SCAFFOLD: the marks are generated, not stored. `rankEntries`, `weeksWithResults`
// and `leaderboardStats` are real logic that survives; COHORT and `quizScore`
// are the stand-in for a `quiz_attempts` query. When the schema lands, replace
// the roster/score lookup in `buildWeeklyLeaderboard` with:
//
//   select student_id, quiz_id, score from quiz_attempts
//   where quiz_id in ('w{n}-sat', 'w{n}-sun')
//
// then feed the rows through `rankEntries` unchanged.

/** Scaffold roster — replaced by the students table. */
const ROSTER: { id: string; name: string }[] = [
  { id: "s-01", name: "Aarav Menon" },
  { id: "s-02", name: "Priya Raghavan" },
  { id: "s-03", name: "Daniel Okafor" },
  { id: "s-04", name: "Mei Lin Chen" },
  { id: "s-05", name: "Fatima Al-Sayed" },
  { id: "s-06", name: "Tomás Herrera" },
  { id: "s-07", name: "Nguyen Bao Anh" },
  { id: "s-08", name: "Sofia Almeida" },
  { id: "s-09", name: "Kwame Boateng" },
  { id: "s-10", name: "Yuki Tanaka" },
  { id: "s-11", name: "Elena Petrova" },
  { id: "s-12", name: "Rahul Deshpande" },
  { id: "s-13", name: "Amira Haddad" },
  { id: "s-14", name: "Lucas Moreau" },
];

/** FNV-1a. Deterministic so server and client render identical marks. */
function hash(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * One student's mark on one weekend paper, or null when they skipped it.
 * Roughly one attempt in nine is missed, and the Sunday assessment scores a
 * little lower than the Saturday practice — it is the longer, graded paper.
 */
function quizScore(
  studentId: string,
  weekNumber: number,
  day: "saturday" | "sunday",
): number | null {
  const h = hash(`${studentId}:w${weekNumber}:${day}`);
  if (h % 9 === 0) return null;

  const penalty = day === "sunday" ? 6 : 0;
  return Math.max(0, WEEKEND_QUIZ_MAX - 40 + ((h >>> 8) % 41) - penalty);
}

function totalOf(scores: WeekendScores): number {
  return (scores.saturday ?? 0) + (scores.sunday ?? 0);
}

function attemptedOf(scores: WeekendScores): number {
  return (scores.saturday === null ? 0 : 1) + (scores.sunday === null ? 0 : 1);
}

/**
 * Sort by weekly total and assign competition ranks (1, 2, 2, 4 — ties share a
 * rank and the next one skips). Ties break on the Sunday assessment first, since
 * the graded paper is the one that should separate two equal totals, then on
 * name so the order never wobbles between renders.
 */
export function rankEntries(
  rows: Omit<LeaderboardEntry, "rank" | "total" | "attempted">[],
): LeaderboardEntry[] {
  const scored = rows
    .map((row) => ({
      ...row,
      total: totalOf(row.scores),
      attempted: attemptedOf(row.scores),
    }))
    .sort(
      (a, b) =>
        b.total - a.total ||
        (b.scores.sunday ?? 0) - (a.scores.sunday ?? 0) ||
        a.name.localeCompare(b.name),
    );

  let rank = 0;
  let previousTotal = Number.NaN;

  return scored.map((row, i) => {
    if (row.total !== previousTotal) {
      rank = i + 1;
      previousTotal = row.total;
    }
    return { ...row, rank };
  });
}

/**
 * Weeks with a board to show — both weekend quizzes published. An unpublished
 * week has nothing to rank, so it never reaches the week switcher.
 */
export function weeksWithResults(
  weeks: CurriculumWeek[] = buildCurriculum(),
): CurriculumWeek[] {
  return weeks.filter(
    (week) =>
      week.quizzes.length > 0 &&
      week.quizzes.every((quiz) => quiz.status === "published"),
  );
}

/** The week a board opens on: the most recent one with results. */
export function latestWeekWithResults(): number | null {
  return weeksWithResults().at(-1)?.weekNumber ?? null;
}

/**
 * The board for one week. Every student is ranked together — the only axis is
 * the week.
 *
 * `viewer` is the signed-in student, appended to the roster so they always have
 * a row of their own to find. Staff pass nothing — an admin is not a competitor.
 */
export function buildWeeklyLeaderboard(
  weekNumber: number,
  options: {
    viewer?: { id: string; name: string; avatarUrl: string | null };
  } = {},
): WeeklyLeaderboard {
  const { viewer } = options;
  const week = weeksWithResults().find((w) => w.weekNumber === weekNumber);

  const roster = [
    ...ROSTER.map((s) => ({ ...s, avatarUrl: null, isViewer: false })),
    ...(viewer ? [{ ...viewer, isViewer: true }] : []),
  ];

  const entries = week
    ? rankEntries(
        roster.map((student) => ({
          studentId: student.id,
          name: student.name,
          avatarUrl: student.avatarUrl,
          isViewer: student.isViewer,
          scores: {
            saturday: quizScore(student.id, weekNumber, "saturday"),
            sunday: quizScore(student.id, weekNumber, "sunday"),
          },
        })),
      )
    : [];

  return {
    weekNumber,
    title: week?.title ?? "",
    entries,
    viewer: entries.find((e) => e.isViewer) ?? null,
    participants: entries.length,
  };
}

/**
 * Scaffold: which roster students the signed-in trainer is responsible for.
 * Replaced by `select student_id from student_trainer_assignments where
 * trainer_id = $1` once the assignment table lands.
 */
const ASSIGNED_STUDENT_IDS = new Set([
  "s-01",
  "s-03",
  "s-05",
  "s-08",
  "s-10",
  "s-12",
  "s-13",
]);

/**
 * A trainer's board for one week: their assigned students only, ranked against
 * each other — but carrying the cohort-wide rank alongside.
 *
 * Both numbers matter and they routinely disagree. A trainer's own #1 may be
 * 6th of 14 across the programme, and a student ranked 5th here can still be
 * ahead of most students under other trainers. Ranking the subset in isolation
 * would hide that, so the cohort standing is computed on the FULL board first
 * and carried through; only `groupRank` is recomputed on the subset.
 */
export function buildTrainerLeaderboard(weekNumber: number): TrainerLeaderboard {
  const board = buildWeeklyLeaderboard(weekNumber);
  const mine = board.entries.filter((e) => ASSIGNED_STUDENT_IDS.has(e.studentId));

  // Re-rank the subset through the same comparator the cohort board uses, so
  // ties and tie-breaks behave identically at both scopes.
  const cohortRankById = new Map(mine.map((e) => [e.studentId, e.rank]));
  const entries = rankEntries(
    mine.map(({ studentId, name, avatarUrl, isViewer, scores }) => ({
      studentId,
      name,
      avatarUrl,
      isViewer,
      scores,
    })),
  ).map((entry) => ({
    ...entry,
    groupRank: entry.rank,
    cohortRank: cohortRankById.get(entry.studentId) ?? entry.rank,
  }));

  return {
    weekNumber,
    title: board.title,
    entries,
    assigned: entries.length,
    cohortSize: board.participants,
  };
}

/** Header rollup for the admin board. */
export function leaderboardStats(entries: LeaderboardEntry[]): LeaderboardStats {
  if (entries.length === 0) {
    return { topScore: 0, average: 0, bothAttempted: 0, noneAttempted: 0 };
  }

  const sum = entries.reduce((acc, e) => acc + e.total, 0);

  return {
    topScore: Math.max(...entries.map((e) => e.total)),
    average: Math.round(sum / entries.length),
    bothAttempted: entries.filter((e) => e.attempted === 2).length,
    noneAttempted: entries.filter((e) => e.attempted === 0).length,
  };
}
