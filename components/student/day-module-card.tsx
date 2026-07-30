"use client";

import * as React from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Clock3,
  Download,
  Eye,
  FileText,
  Lock,
  type LucideIcon,
  PlayCircle,
  RotateCcw,
  Send,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { StudentDay, TaskState } from "@/lib/student/progress";

// One teaching day, as the student sees it: watch the class, take the notes,
// send the task. The three steps are always in that order because that is the
// order the day is taught in — and each one shows whether it is done, so the
// card doubles as the day's checklist.
//
// Client component: submitting the task is the one thing a student actually
// does here, and it needs local state for the composer.

/** How each task state presents. Shared with the learning-path timeline. */
export const TASK_BADGE: Record<
  TaskState,
  { label: string; variant: "positive" | "warning" | "negative" | "neutral"; icon: LucideIcon }
> = {
  open: { label: "Not sent yet", variant: "neutral", icon: Clock3 },
  submitted: { label: "With your trainer", variant: "warning", icon: Clock3 },
  reviewed: { label: "Reviewed", variant: "positive", icon: CheckCircle2 },
  redo: { label: "Redo requested", variant: "negative", icon: RotateCcw },
  missed: { label: "Missed", variant: "negative", icon: XCircle },
};

export function DayModuleCard({
  day,
  compact = false,
}: {
  day: StudentDay;
  /**
   * Tighter rows, matching the admin content manager's day card. Used in the
   * learning path, where five of these stack under a week; the home screen
   * leaves it off so today's card reads as the page's hero.
   */
  compact?: boolean;
}) {
  const locked = day.state === "locked";
  const state = day.task.state;
  const badge = TASK_BADGE[state];
  const dayHref = `/student/learning-path/${day.dayNumber}`;

  return (
    <article
      className={cn(
        "overflow-hidden rounded-xl border bg-card",
        day.state === "today" && compact ? "border-ink" : "border-border",
      )}
    >
      {/* Day header */}
      <header
        className={cn(
          "flex flex-wrap items-center justify-between gap-4 border-b border-border",
          compact ? "px-4 py-3" : "p-6",
        )}
      >
        {compact ? (
          <div className="flex items-center gap-3">
            <span
              className={cn(
                "grid size-9 shrink-0 place-items-center rounded-lg text-sm font-extrabold",
                day.state === "today"
                  ? "bg-primary text-primary-foreground"
                  : day.state === "done"
                    ? "bg-primary-pale text-ink-deep"
                    : "bg-secondary text-mute",
              )}
            >
              {locked ? <Lock className="size-4" /> : day.dayNumber}
            </span>
            <div>
              <div className="text-sm font-semibold text-ink">{day.video.title}</div>
              <div className="text-xs text-mute">
                {day.state === "today"
                  ? "Today's class"
                  : `Weekday ${day.weekday} of 5`}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <Badge variant={day.state === "today" ? "brand" : "neutral"}>
                {day.state === "today" ? "Today" : `Day ${day.dayNumber}`}
              </Badge>
              <span className="text-xs text-mute">Week {day.weekNumber}</span>
            </div>
            <h2 className="font-display text-2xl font-extrabold tracking-tight text-ink">
              {day.video.title}
            </h2>
          </div>
        )}

        <div className="flex items-center gap-2">
          {locked ? (
            <Badge variant="outline">
              <Lock className="size-3.5" />
              Locked
            </Badge>
          ) : (
            <>
              <Badge variant={badge.variant}>
                <badge.icon className="size-3.5" />
                {badge.label}
              </Badge>
              <Button variant="ghost" size="sm" asChild>
                <Link href={dayHref} aria-label={`Open ${day.video.title}`}>
                  <Eye />
                  View
                </Link>
              </Button>
            </>
          )}
        </div>
      </header>

      {locked ? (
        <div
          className={cn(
            "flex flex-col items-center gap-2 px-6 text-center",
            compact ? "py-6" : "py-12",
          )}
        >
          <Lock className="size-5 text-mute" />
          <p className="text-sm text-body">
            Day {day.dayNumber} unlocks once you finish the days before it.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {/* 1. The class */}
          <Step
            compact={compact}
            icon={PlayCircle}
            title={day.video.title}
            meta={`${day.video.durationMin} min class`}
            done={day.video.watched}
            action={
              <Button variant="soft" size="sm" asChild>
                <Link href={dayHref}>
                  <PlayCircle />
                  {day.video.watched ? "Watch again" : "Watch class"}
                </Link>
              </Button>
            }
          />

          {/* 2. The notes */}
          <Step
            compact={compact}
            icon={FileText}
            title={day.notes.title}
            meta="PDF handout"
            done={day.notes.downloaded}
            action={
              <Button variant="secondary" size="sm" asChild>
                <Link href={dayHref}>
                  <Download />
                  Download
                </Link>
              </Button>
            }
          />

          {/* 3. The task — the only step with a state machine behind it. */}
          <Step
            compact={compact}
            icon={Send}
            title={day.task.title}
            meta={day.task.prompt}
            done={state === "reviewed" || state === "submitted"}
            action={
              <Button
                size="sm"
                variant={state === "redo" ? "destructive" : "soft"}
                asChild
              >
                <Link href={dayHref}>
                  <Send />
                  {state === "redo"
                    ? "Redo task"
                    : state === "submitted" || state === "reviewed"
                      ? "View task"
                      : "Open task"}
                </Link>
              </Button>
            }
          />
        </div>
      )}

      {/* Trainer's verdict, once there is one. */}
      {day.task.feedback && (
        <TrainerNote
          feedback={day.task.feedback}
          score={day.task.score}
          author={day.task.reviewedBy}
          tone={day.task.state === "redo" ? "redo" : "reviewed"}
          compact={compact}
        />
      )}
    </article>
  );
}

/** One row of the day: what it is, whether it is done, and how to do it. */
function Step({
  icon: Icon,
  title,
  meta,
  done,
  action,
  compact,
}: {
  icon: LucideIcon;
  title: string;
  meta: string;
  done: boolean;
  action: React.ReactNode;
  compact: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between",
        compact ? "px-4 py-3" : "p-6",
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-full",
            done ? "bg-primary-pale text-positive-deep" : "bg-secondary text-ink",
          )}
        >
          {done ? <CheckCircle2 className="size-4" /> : <Icon className="size-4" />}
        </span>
        <div className="min-w-0">
          <div className={cn("font-semibold text-ink", compact && "text-sm")}>
            {title}
          </div>
          <p className={cn("text-body", compact ? "truncate text-xs" : "text-sm")}>
            {meta}
          </p>
        </div>
      </div>
      {action && <div className="shrink-0 sm:pl-4">{action}</div>}
    </div>
  );
}

/** The trainer's feedback, quoted back to the student. */
function TrainerNote({
  feedback,
  score,
  author,
  tone,
  compact,
}: {
  feedback: string;
  score: number | null;
  author: string | null;
  tone: "reviewed" | "redo";
  compact: boolean;
}) {
  return (
    <div
      className={cn(
        "border-t",
        compact ? "px-4 py-3" : "p-6",
        tone === "redo"
          ? "border-destructive/20 bg-destructive/5"
          : "border-border bg-primary-pale/40",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm font-semibold text-ink">
          {author ? `${author}'s feedback` : "Trainer feedback"}
        </span>
        {score !== null && (
          <span className="font-display text-xl font-extrabold tabular-nums text-ink">
            {score}
            <span className="text-sm font-semibold text-mute">/100</span>
          </span>
        )}
      </div>
      <p className="mt-1.5 text-sm text-body">{feedback}</p>
    </div>
  );
}
