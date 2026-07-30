import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/guards";
import { getReviewComments, getReviewSubmission } from "@/lib/tasks/queries";
import { ReviewDetail } from "@/components/trainer/review-detail";
import type { Role } from "@/types/role";

// Trainer > Review one submission — answers, approve/redo, realtime thread.
export default async function Page({
  params,
}: {
  params: Promise<{ submissionId: string }>;
}) {
  const user = await requireRole("trainer");
  const { submissionId } = await params;

  const detail = await getReviewSubmission(submissionId);
  if (!detail) notFound();

  const comments = await getReviewComments(submissionId);

  const threadAuthors: Record<string, { name: string; role: Role | null }> = {
    [user.id]: { name: user.fullName ?? user.email, role: "trainer" },
    [detail.studentId]: { name: detail.studentName, role: "student" },
  };

  return (
    <ReviewDetail
      detail={detail}
      comments={comments}
      meId={user.id}
      threadAuthors={threadAuthors}
    />
  );
}
