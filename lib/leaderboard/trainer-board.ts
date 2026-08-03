import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/guards";
import { loadAdminLeaderboard } from "@/lib/leaderboard/board";
import { rankEntries } from "@/lib/leaderboard/weekly";
import type {
  TrainerLeaderboard,
  TrainerLeaderboardEntry,
} from "@/types/leaderboard";

// Server-only loader for a trainer's weekly leaderboard: their assigned students
// ranked against each other on the two weekend quizzes (25 marks each, summed),
// with each row also carrying its cohort-wide standing.
//
// Both numbers are computed from the SAME cohort board (loadAdminLeaderboard),
// so ranks and tie-breaks agree at both scopes: cohortRank comes straight off
// the cohort board; groupRank is the subset re-ranked through the same
// comparator.

export async function loadTrainerLeaderboard(): Promise<TrainerLeaderboard[]> {
  const user = await getCurrentUser();
  if (!user) return [];

  const supabase = await createClient();
  const { data: links } = await supabase
    .from("student_trainer_assignments")
    .select("student_id")
    .eq("trainer_id", user.id);
  const assigned = new Set(
    ((links ?? []) as { student_id: string }[]).map((l) => l.student_id),
  );

  const cohort = await loadAdminLeaderboard();

  // A trainer's students can sit on different courses, so this keeps one board
  // per course-week and drops the ones none of their students appear on.
  return cohort
    .map((board) => {
      const mine = board.entries.filter((e) => assigned.has(e.studentId));
      const cohortRankById = new Map(mine.map((e) => [e.studentId, e.rank]));

      const entries: TrainerLeaderboardEntry[] = rankEntries(
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
        courseId: board.courseId,
        courseTitle: board.courseTitle,
        weekNumber: board.weekNumber,
        title: board.title,
        entries,
        assigned: entries.length,
        cohortSize: board.participants,
      };
    })
    .filter((board) => board.entries.length > 0);
}
