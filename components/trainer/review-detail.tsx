"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, Loader2, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { ReviewThread } from "@/components/tasks/review-thread";
import { setSubmissionStatus } from "@/lib/tasks/actions";
import {
  QUESTION_TYPE_LABEL,
  STATUS_LABEL,
  type ReviewComment,
  type SubmissionAnswer,
  type SubmissionStatus,
  type TaskQuestion,
} from "@/types/task";
import type { Role } from "@/types/role";

// Trainer > Review a submission: the questions with the student's answers, the
// approve / request-redo decision, and the realtime comment thread.

export type ReviewDetailData = {
  submissionId: string;
  dayNumber: number;
  taskTitle: string;
  status: SubmissionStatus;
  studentId: string;
  studentName: string;
  questions: TaskQuestion[];
  answers: SubmissionAnswer[];
};

const STATUS_VARIANT: Record<SubmissionStatus, "warning" | "positive" | "negative"> = {
  submitted: "warning",
  approved: "positive",
  redo: "negative",
};

function slotKey(questionId: string, followupId: string | null): string {
  return `${questionId}::${followupId ?? ""}`;
}

export function ReviewDetail({
  detail,
  comments,
  meId,
  threadAuthors,
}: {
  detail: ReviewDetailData;
  comments: ReviewComment[];
  meId: string;
  threadAuthors: Record<string, { name: string; role: Role | null }>;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState<null | "approved" | "redo">(null);

  const answerBy = React.useMemo(() => {
    const m = new Map<string, SubmissionAnswer>();
    for (const a of detail.answers) m.set(slotKey(a.questionId, a.followupId), a);
    return m;
  }, [detail.answers]);

  async function decide(status: "approved" | "redo") {
    setPending(status);
    const result = await setSubmissionStatus({
      submissionId: detail.submissionId,
      status,
    });
    setPending(null);
    if (result.ok) {
      toast.success(status === "approved" ? "Approved" : "Redo requested");
      router.refresh();
    } else {
      toast.error("Couldn't update", { description: result.error });
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/trainer/review-tasks"
        className="inline-flex items-center gap-2 text-sm font-semibold text-body transition-colors hover:text-ink"
      >
        <ArrowLeft className="size-4" />
        Review tasks
      </Link>

      <header className="mt-4 flex flex-col gap-3 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink">
            {detail.studentName}
          </h1>
          <p className="mt-1 text-sm text-body">
            Day {detail.dayNumber} · {detail.taskTitle}
          </p>
        </div>
        <Badge variant={STATUS_VARIANT[detail.status]} className="self-start">
          {STATUS_LABEL[detail.status]}
        </Badge>
      </header>

      {/* Answers */}
      <div className="mt-6 flex flex-col gap-4">
        {detail.questions.length === 0 ? (
          <p className="text-sm text-mute">This task has no questions.</p>
        ) : (
          detail.questions.map((q, qi) => (
            <div key={q.id} className="rounded-xl border border-border bg-card p-4">
              <div className="mb-2 flex items-center gap-2">
                <span className="text-sm font-semibold text-ink">Q{qi + 1}</span>
                <Badge variant="outline">{QUESTION_TYPE_LABEL[q.type]}</Badge>
              </div>
              {q.prompt ? (
                <p className="whitespace-pre-wrap text-sm text-body">{q.prompt}</p>
              ) : null}
              {q.passage ? (
                <div className="mt-2 whitespace-pre-wrap rounded-lg bg-muted px-4 py-3 text-sm text-body">
                  {q.passage}
                </div>
              ) : null}

              {q.type === "comprehension" ? (
                <div className="mt-3 flex flex-col gap-3">
                  {q.followups.map((f, i) => (
                    <AnswerBlock
                      key={f.id}
                      label={`${i + 1}. ${f.prompt}`}
                      answer={answerBy.get(slotKey(q.id, f.id)) ?? null}
                    />
                  ))}
                </div>
              ) : (
                <div className="mt-3">
                  <AnswerBlock
                    label="Answer"
                    answer={answerBy.get(slotKey(q.id, null)) ?? null}
                  />
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Decision */}
      <div className="mt-6 flex items-center justify-end gap-2">
        <Button
          variant="secondary"
          disabled={pending !== null}
          onClick={() => decide("redo")}
        >
          {pending === "redo" ? <Loader2 className="animate-spin" /> : <RotateCcw />}
          Request redo
        </Button>
        <Button disabled={pending !== null} onClick={() => decide("approved")}>
          {pending === "approved" ? (
            <Loader2 className="animate-spin" />
          ) : (
            <CheckCircle2 />
          )}
          Approve
        </Button>
      </div>

      {/* Realtime thread */}
      <section className="mt-8">
        <h2 className="mb-2 text-sm font-semibold text-ink">Discussion</h2>
        <ReviewThread
          submissionId={detail.submissionId}
          meId={meId}
          initialComments={comments}
          authors={threadAuthors}
          placeholder={`Comment for ${detail.studentName.split(" ")[0]}…`}
        />
      </section>
    </div>
  );
}

function AnswerBlock({
  label,
  answer,
}: {
  label: string;
  answer: SubmissionAnswer | null;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
      <div className="text-xs font-medium text-ink">{label}</div>
      {answer?.text ? (
        <p className="whitespace-pre-wrap text-sm text-body">{answer.text}</p>
      ) : null}
      {answer?.audio ? (
        <audio controls src={answer.audio.url} className="h-9 w-full max-w-sm" />
      ) : null}
      {!answer?.text && !answer?.audio ? (
        <p className="text-sm text-mute">No answer.</p>
      ) : null}
    </div>
  );
}
