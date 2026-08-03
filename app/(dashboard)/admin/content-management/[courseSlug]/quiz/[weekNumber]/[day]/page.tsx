import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/guards";
import { getAdminQuiz, getCourseBySlug } from "@/lib/content/queries";
import { QuizBuilder } from "@/components/admin/quiz-builder";

// Admin > Content > one course > weekend quiz builder for one (week, day) paper.
// Week numbers restart per course, so the course slug is part of the lookup.
export default async function Page({
  params,
}: {
  params: Promise<{ courseSlug: string; weekNumber: string; day: string }>;
}) {
  await requireRole("admin");
  const { courseSlug, weekNumber, day } = await params;

  const wn = Number(weekNumber);
  if (
    !Number.isInteger(wn) ||
    wn < 1 ||
    (day !== "saturday" && day !== "sunday")
  ) {
    notFound();
  }

  const course = await getCourseBySlug(courseSlug);
  if (!course) notFound();

  const quiz = await getAdminQuiz(course, wn, day);
  if (!quiz) notFound();

  return <QuizBuilder quiz={quiz} />;
}
