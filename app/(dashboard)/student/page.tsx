import { requireRole } from "@/lib/auth/guards";
import { loadJourney } from "@/lib/student/journey";
import { StudentOverview } from "@/components/student/student-overview";

// Student home — today's class, notes and task, with progress and recent
// trainer feedback around them. Chrome (sidebar, topbar, breadcrumb) comes from
// the (dashboard) layout — this renders content only.
export default async function StudentDashboard() {
  const user = await requireRole("student");

  // First name only — "Hello, Aarav" reads better than the full name.
  const name = (user.fullName ?? user.email).split(/[\s@]/)[0];

  return <StudentOverview name={name} journey={await loadJourney()} />;
}
