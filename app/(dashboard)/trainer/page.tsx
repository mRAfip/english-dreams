import { requireRole } from "@/lib/auth/guards";
import { TrainerOverview } from "@/components/trainer/trainer-overview";
import { loadAssignedStudents } from "@/lib/trainer/queries";
import { getReviewQueue } from "@/lib/tasks/queries";

// Trainer home — day-to-day operations: what is waiting to be reviewed, which
// students are slipping, and how the week is tracking. Chrome (sidebar, topbar,
// breadcrumb) comes from the (dashboard) layout — this renders content only.
export default async function TrainerDashboard() {
  const user = await requireRole("trainer");

  // First name only — "Good morning, Nadia" reads better than the full name.
  const name = (user.fullName ?? user.email).split(/[\s@]/)[0];

  const [queue, roster] = await Promise.all([
    getReviewQueue(),
    loadAssignedStudents(user.id),
  ]);

  return <TrainerOverview name={name} queue={queue} roster={roster} />;
}
