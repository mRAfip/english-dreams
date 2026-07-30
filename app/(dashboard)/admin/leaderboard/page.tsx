import { requireRole } from "@/lib/auth/guards";
import { loadAdminLeaderboard } from "@/lib/leaderboard/board";
import { LeaderboardTable } from "@/components/admin/leaderboard-table";

// Admin > Leaderboard — weekly ranking across the cohort, scored on the week's
// two weekend quizzes (Saturday practice + Sunday assessment), 25 marks each,
// summed to 50. Built from real students + their stored quiz attempts.
export default async function Page() {
  await requireRole("admin");
  const boards = await loadAdminLeaderboard();
  return <LeaderboardTable boards={boards} />;
}
