import { ContentManager } from "@/components/admin/content-manager";
import { getCurriculum } from "@/lib/content/queries";

// Admin > Content Management
// Author/curate the 60-day curriculum: weeks, days, tasks, and media (R2).
// Data is loaded from Supabase and mutated via Server Actions.
export default async function Page() {
  const weeks = await getCurriculum();
  return <ContentManager weeks={weeks} />;
}
