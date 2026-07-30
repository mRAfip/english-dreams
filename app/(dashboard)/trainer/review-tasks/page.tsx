import { requireRole } from "@/lib/auth/guards";
import { getReviewQueue } from "@/lib/tasks/queries";
import { ReviewQueue } from "@/components/trainer/review-queue";

// Trainer > Review tasks — the queue of the trainer's assigned students'
// submissions. Clicking one opens the review detail.
export default async function Page() {
  await requireRole("trainer");
  const items = await getReviewQueue();
  return <ReviewQueue items={items} />;
}
