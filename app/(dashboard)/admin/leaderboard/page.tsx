import { requireRole } from "@/lib/auth/guards";
import { loadAdminLeaderboard } from "@/lib/leaderboard/board";
import { LeaderboardTable } from "@/components/admin/leaderboard-table";

// Admin > Leaderboard — weekly ranking, scored on the week's two graded weekend
// papers (Saturday + Sunday), 25 marks each, summed to 50. Only students who
// have sat a paper that week are ranked. Built from real students + attempts.
export default async function Page() {
  await requireRole("admin");
  const boards = await loadAdminLeaderboard();
  return <LeaderboardTable boards={boards} />;
}
