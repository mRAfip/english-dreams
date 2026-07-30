import { loadJourney } from "@/lib/student/journey";
import { LearningPathTimeline } from "@/components/student/learning-path-timeline";

// Student > Learning Path — the whole programme, week by week, with any day
// expandable in place so old tasks can be redone from here. Content comes from
// the admin-authored tables; only published days are unlocked.
export default async function Page() {
  return <LearningPathTimeline journey={await loadJourney()} />;
}
