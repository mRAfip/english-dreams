import { loadJourney } from "@/lib/student/journey";
import { LearningPathTimeline } from "@/components/student/learning-path-timeline";
import { NoCourseAssigned } from "@/components/student/no-course";

// Student > Learning Path — their course, week by week, with any day expandable
// in place so old tasks can be redone from here. Content comes from the
// admin-authored tables for the course they're assigned to; only published days
// are unlocked.
export default async function Page() {
  const journey = await loadJourney();
  if (!journey.course) return <NoCourseAssigned />;
  return <LearningPathTimeline journey={journey} />;
}
