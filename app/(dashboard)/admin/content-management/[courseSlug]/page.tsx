import { notFound } from "next/navigation";
import { ContentManager } from "@/components/admin/content-manager";
import { getCourseBySlug, getCurriculum } from "@/lib/content/queries";

// Admin > Content > one course — author its weeks, days, tasks and media (R2).
// Data is loaded from Supabase and mutated via Server Actions.
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ courseSlug: string }>;
  searchParams: Promise<{ week?: string }>;
}) {
  const { courseSlug } = await params;
  const { week } = await searchParams;

  const course = await getCourseBySlug(courseSlug);
  if (!course) notFound();

  const weeks = await getCurriculum(course.id);

  let initialWeek = week ? parseInt(week, 10) : 1;
  if (isNaN(initialWeek) || initialWeek < 1) {
    initialWeek = 1;
  }

  return <ContentManager course={course} weeks={weeks} initialWeek={initialWeek} />;
}
