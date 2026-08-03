import {
  type LeaderboardEntry,
  type LeaderboardStats,
  type WeekendScores,
} from "@/types/leaderboard";

// Ranking logic for the weekly leaderboard, shared by the admin, trainer and
// student boards. Client-safe: pure functions over rows that a server loader
// (lib/leaderboard/board.ts) has already read from Supabase.
//
// A board covers ONE (course, week) pair. Ranking students from different
// courses against each other would compare marks from different papers, so the
// loader groups by course first and only then calls in here.

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
