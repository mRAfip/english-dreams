"use client";

import * as React from "react";
import Link from "next/link";
import { ClipboardList, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { TableEmpty } from "@/components/ui/table";
import { SearchField } from "@/components/admin/directory-toolbar";
import { STATUS_LABEL, type ReviewQueueItem, type SubmissionStatus } from "@/types/task";

// Trainer > Review tasks — the queue of submissions from this trainer's
// assigned students, pending first. Each links to the review detail.

const STATUS_VARIANT: Record<SubmissionStatus, "warning" | "positive" | "negative"> = {
  submitted: "warning",
  approved: "positive",
  redo: "negative",
};

export function ReviewQueue({ items }: { items: ReviewQueueItem[] }) {
  const [query, setQuery] = React.useState("");
  const term = query.trim().toLowerCase();
  const shown = term
    ? items.filter(
        (i) =>
          i.studentName.toLowerCase().includes(term) ||
          i.taskTitle.toLowerCase().includes(term),
      )
    : items;

  const pending = items.filter((i) => i.status === "submitted").length;

  return (
    <div>
      <header className="flex flex-col gap-1.5 border-b border-border pb-6">
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink">
          Review tasks
        </h1>
        <p className="text-sm text-body">
          {pending} awaiting review · {items.length} total
        </p>
      </header>

      <div className="mt-6 max-w-sm">
        <SearchField
          value={query}
          onChange={setQuery}
          placeholder="Search student or task"
          label="Search submissions"
          className="sm:w-full"
        />
      </div>

      <div className="mt-4">
        {shown.length === 0 ? (
          <TableEmpty
            icon={ClipboardList}
            message={
              items.length === 0
                ? "No submissions to review yet."
                : "Nothing matches your search."
            }
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {shown.map((item) => (
              <li key={item.submissionId}>
                <Link
                  href={`/trainer/review-tasks/${item.submissionId}`}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-mute/40 hover:bg-muted",
                  )}
                >
                  <Avatar>
                    {item.studentAvatarUrl && (
                      <AvatarImage src={item.studentAvatarUrl} alt="" />
                    )}
                    <AvatarFallback>{initials(item.studentName)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-ink">{item.studentName}</div>
                    <div className="truncate text-xs text-mute">
                      Day {item.dayNumber} · {item.taskTitle}
                      {item.totalQuestions
                        ? ` · ${item.answeredQuestions ?? item.answerCount} of ${item.totalQuestions} answered`
                        : ` · ${item.answerCount} ${item.answerCount === 1 ? "answer" : "answers"}`}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <div className="flex flex-col items-end gap-1">
                      <Badge variant={STATUS_VARIANT[item.status]}>
                        {STATUS_LABEL[item.status]}
                      </Badge>
                      <span className="text-xs text-mute">{item.submittedAt}</span>
                    </div>
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-secondary px-3 py-2 text-sm font-semibold text-ink">
                      <Eye className="size-4" />
                      <span className="hidden sm:inline">View</span>
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
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
