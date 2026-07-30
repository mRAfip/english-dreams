"use client";

import { CheckCircle2, ClipboardCheck, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { TableEmpty } from "@/components/ui/table";
import {
  slaLevel,
  submissionWeek,
  waitingLabel,
  type Submission,
} from "@/lib/tasks/review";

// TaskReviewList (trainer) — the left rail of the review screen: one row per
// submitted task, ordered by how long it has been waiting. Selection only; the
// grading happens in GradingPanel beside it.

export function TaskReviewList({
  submissions,
  selectedId,
  onSelect,
}: {
  submissions: Submission[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  if (submissions.length === 0) {
    return (
      <TableEmpty icon={CheckCircle2} message="Nothing left in this queue." />
    );
  }

  return (
    <ul
      // Tall lists scroll inside the rail so the grading panel stays put.
      className="flex max-h-[calc(100vh-16rem)] flex-col gap-2 overflow-y-auto pr-1"
    >
      {submissions.map((s) => (
        <li key={s.id}>
          <SubmissionRow
            submission={s}
            selected={s.id === selectedId}
            onSelect={() => onSelect(s.id)}
          />
        </li>
      ))}
    </ul>
  );
}

function SubmissionRow({
  submission: s,
  selected,
  onSelect,
}: {
  submission: Submission;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={selected ? "true" : undefined}
      className={cn(
        "w-full rounded-xl border bg-card p-4 text-left transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        selected
          ? "border-ink bg-primary-pale/40"
          : "border-border hover:bg-secondary/40",
      )}
    >
      <div className="flex items-start gap-3">
        <Avatar>
          <AvatarFallback>{initials(s.studentName)}</AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="truncate font-semibold text-ink">
              {s.studentName}
            </span>
            <span className="shrink-0 text-xs text-mute">{s.submittedAt}</span>
          </div>

          <div className="truncate text-xs text-mute">
            Week {submissionWeek(s)} · Day {s.dayNumber} · {s.taskTitle}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <StatusBadge submission={s} />
            {s.late && <Badge variant="outline">Submitted late</Badge>}
          </div>
        </div>
      </div>
    </button>
  );
}

/** Pending rows show how long they've waited; graded rows show the outcome. */
function StatusBadge({ submission: s }: { submission: Submission }) {
  if (s.status === "approved") {
    return (
      <Badge variant="positive">
        <CheckCircle2 className="size-3.5" />
        Approved · {s.score}%
      </Badge>
    );
  }

  if (s.status === "redo") {
    return (
      <Badge variant="negative">
        <RotateCcw className="size-3.5" />
        Redo requested
      </Badge>
    );
  }

  const sla = slaLevel(s);
  return (
    <Badge
      variant={
        sla === "overdue" ? "negative" : sla === "due" ? "warning" : "neutral"
      }
    >
      <ClipboardCheck className="size-3.5" />
      {waitingLabel(s.hoursWaiting)}
    </Badge>
  );
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}
