import { requireRole } from "@/lib/auth/guards";
import { getAdminOverview } from "@/lib/admin/overview";
import { AdminOverview } from "@/components/admin/admin-overview";

// Admin home — day-to-day operations from live data: the numbers, the students
// who need chasing, and each trainer's load. On a fresh install it shows an
// onboarding screen instead. Chrome comes from the (dashboard) layout.
export default async function AdminDashboard() {
  const user = await requireRole("admin");

  // First name only — "Welcome back, Priya" reads better than the full name.
  const name = (user.fullName ?? user.email).split(/[\s@]/)[0];
  const data = await getAdminOverview();

  return <AdminOverview name={name} data={data} />;
}
