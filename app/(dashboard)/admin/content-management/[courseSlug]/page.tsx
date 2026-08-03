import { notFound } from "next/navigation";
import { ContentManager } from "@/components/admin/content-manager";
import { getCourseBySlug, getCurriculum } from "@/lib/content/queries";

// Admin > Content > one course — author its weeks, days, tasks and media (R2).
// Data is loaded from Supabase and mutated via Server Actions.
export default async function Page({
  params,
}: {
  params: Promise<{ courseSlug: string }>;
}) {
  const { courseSlug } = await params;

  const course = await getCourseBySlug(courseSlug);
  if (!course) notFound();

  const weeks = await getCurriculum(course.id);
  return <ContentManager course={course} weeks={weeks} />;
}
