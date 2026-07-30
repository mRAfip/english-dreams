"use client";

import * as React from "react";
import {
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Image as ImageIcon,
  Mic,
  Play,
  RotateCcw,
  Video,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  submissionWeek,
  waitingLabel,
  type ReviewStatus,
  type Submission,
  type SubmissionAsset,
} from "@/lib/tasks/review";

// GradingPanel (trainer) — the working surface: the task that was set, what the
// student handed in, and the score + feedback form.
//
// Mount with `key={submission.id}` so switching rows resets the draft state
// instead of carrying one student's feedback over to the next.

const ASSET_ICON: Record<SubmissionAsset["kind"], LucideIcon> = {
  audio: Mic,
  video: Video,
  document: FileText,
  image: ImageIcon,
};

/** Canned openers. Grading 20 tasks a day, a trainer types the same phrases. */
const QUICK_FEEDBACK = [
  "Clear and well structured — nice work.",
  "Good content, but slow down; the word endings blur.",
  "You missed part of the brief — see the prompt above.",
  "Watch the past-tense endings (-ed) throughout.",
];

export function GradingPanel({
  submission,
  onGrade,
}: {
  submission: Submission;
  /** Called with the trainer's verdict. The parent owns the queue state. */
  onGrade: (result: { status: ReviewStatus; score: number; feedback: string }) => void;
}) {
  const [score, setScore] = React.useState(
    submission.score === null ? "" : String(submission.score),
  );
  const [feedback, setFeedback] = React.useState(submission.feedback);

  const parsed = Number(score);
  const scoreValid = score !== "" && Number.isFinite(parsed) && parsed >= 0 && parsed <= 100;
  const canApprove = scoreValid && feedback.trim().length > 0;
  const reviewed = submission.status !== "pending";

  function submit(status: ReviewStatus) {
    if (!scoreValid) return;
    onGrade({ status, score: parsed, feedback: feedback.trim() });
  }

  return (
    <div className="rounded-xl border border-border bg-card">
      {/* Who and what */}
      <header className="flex flex-col gap-4 border-b border-border p-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <Avatar>
            <AvatarFallback>{initials(submission.studentName)}</AvatarFallback>
          </Avatar>
          <div>
            <h2 className="font-display text-xl font-extrabold text-ink">
              {submission.studentName}
            </h2>
            <p className="text-xs text-mute">{submission.studentEmail}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 sm:justify-end">
          <Badge variant="brand">
            Week {submissionWeek(submission)} · Day {submission.dayNumber}
          </Badge>
          {submission.late && <Badge variant="outline">Submitted late</Badge>}
          {reviewed ? (
            <Badge variant={submission.status === "approved" ? "positive" : "negative"}>
              {submission.status === "approved" ? (
                <CheckCircle2 className="size-3.5" />
              ) : (
                <RotateCcw className="size-3.5" />
              )}
              {submission.status === "approved" ? "Approved" : "Redo requested"}
            </Badge>
          ) : (
            <Badge variant="neutral">
              <ClipboardCheck className="size-3.5" />
              {waitingLabel(submission.hoursWaiting)}
            </Badge>
          )}
        </div>
      </header>

      <div className="flex flex-col gap-6 p-6">
        {/* The brief — grading without it is guesswork. */}
        <section>
          <SectionLabel>The task</SectionLabel>
          <p className="mt-2 font-semibold text-ink">{submission.taskTitle}</p>
          <p className="mt-1 text-sm text-body">{submission.prompt}</p>
        </section>

        {/* What they handed in */}
        <section>
          <SectionLabel>Submission · {submission.submittedAt}</SectionLabel>
          {submission.note && (
            <p className="mt-2 rounded-lg bg-secondary/50 p-4 text-sm text-body">
              {submission.note}
            </p>
          )}

          {submission.assets.length > 0 && (
            <ul className="mt-3 flex flex-col gap-2">
              {submission.assets.map((asset) => (
                <li key={asset.id}>
                  <AssetRow asset={asset} />
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Grade */}
        <section className="border-t border-border pt-6">
          <SectionLabel>Your review</SectionLabel>

          <div className="mt-3 flex flex-col gap-4">
            <div className="grid gap-2 sm:max-w-40">
              <Label htmlFor="score">Score (0-100)</Label>
              <Input
                id="score"
                type="number"
                min={0}
                max={100}
                inputMode="numeric"
                value={score}
                onChange={(e) => setScore(e.target.value)}
                placeholder="—"
                className="tabular-nums"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="feedback">Feedback to the student</Label>
              <Textarea
                id="feedback"
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="What worked, and the one thing to fix next time."
                rows={4}
              />
              <div className="flex flex-wrap gap-2">
                {QUICK_FEEDBACK.map((phrase) => (
                  <button
                    key={phrase}
                    type="button"
                    onClick={() =>
                      setFeedback((prev) => (prev ? `${prev.trim()} ${phrase}` : phrase))
                    }
                    className="rounded-full border border-border px-3 py-1 text-xs text-body transition-colors hover:bg-secondary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {phrase}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button onClick={() => submit("approved")} disabled={!canApprove}>
              <CheckCircle2 />
              {reviewed ? "Update review" : "Approve & send"}
            </Button>
            <Button
              variant="tertiary"
              onClick={() => submit("redo")}
              disabled={!canApprove}
            >
              <RotateCcw />
              Request redo
            </Button>
            {!canApprove && (
              <p className="text-xs text-mute">
                Add a score and a line of feedback to send.
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

/** One attached file. Playback lands with the R2 signing work. */
function AssetRow({ asset }: { asset: SubmissionAsset }) {
  const Icon = ASSET_ICON[asset.kind];
  const playable = asset.kind === "audio" || asset.kind === "video";

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border p-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-ink">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-ink">{asset.name}</div>
        <div className="text-xs text-mute">{asset.meta}</div>
      </div>
      <Button variant="outline" size="sm" disabled={asset.assetKey === null}>
        {playable ? <Play /> : <FileText />}
        {playable ? "Play" : "Open"}
      </Button>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-semibold uppercase tracking-wide text-mute">
      {children}
    </h3>
  );
}

/** Shown in place of the panel when the queue selection is empty. */
export function GradingPanelEmpty({ message }: { message: string }) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-card px-6 py-20 text-center",
      )}
    >
      <div className="flex size-11 items-center justify-center rounded-full bg-secondary">
        <ClipboardCheck className="size-5 text-mute" />
      </div>
      <p className="text-sm text-body">{message}</p>
    </div>
  );
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}
