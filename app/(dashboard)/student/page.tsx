import { requireRole } from "@/lib/auth/guards";
import { loadJourney } from "@/lib/student/journey";
import { StudentOverview } from "@/components/student/student-overview";
import { getStudentSubmissions } from "@/lib/tasks/queries";
import { NoCourseAssigned } from "@/components/student/no-course";
import { getActiveBrandingBanner } from "@/lib/branding/actions";

// Student home — today's class, notes and task, with progress and recent
// trainer feedback around them. Chrome (sidebar, topbar, breadcrumb) comes from
// the (dashboard) layout — this renders content only.
export default async function StudentDashboard() {
  const user = await requireRole("student");

  // First name only — "Hello, Aarav" reads better than the full name.
  const name = (user.fullName ?? user.email).split(/[\s@]/)[0];

  const [journey, submissions, banner] = await Promise.all([
    loadJourney(),
    getStudentSubmissions(user.id),
    getActiveBrandingBanner(),
  ]);

  if (!journey.course) return <NoCourseAssigned />;

  return (
    <StudentOverview
      name={name}
      journey={journey}
      submissions={submissions}
      banner={banner}
    />
  );
}
