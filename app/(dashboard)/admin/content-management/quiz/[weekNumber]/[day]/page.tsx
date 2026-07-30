import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/guards";
import { getAdminQuiz } from "@/lib/content/queries";
import { QuizBuilder } from "@/components/admin/quiz-builder";

// Admin > Content > weekend quiz builder for one (week, day) paper.
export default async function Page({
  params,
}: {
  params: Promise<{ weekNumber: string; day: string }>;
}) {
  await requireRole("admin");
  const { weekNumber, day } = await params;

  const wn = Number(weekNumber);
  if (
    !Number.isInteger(wn) ||
    wn < 1 ||
    (day !== "saturday" && day !== "sunday")
  ) {
    notFound();
  }

  const quiz = await getAdminQuiz(wn, day);
  if (!quiz) notFound();

  return <QuizBuilder quiz={quiz} />;
}
