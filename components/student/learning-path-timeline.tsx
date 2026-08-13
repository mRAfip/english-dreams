"use client";

import * as React from "react";
import { Check, CircleDot, ListChecks, Lock, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DayModuleCard } from "@/components/student/day-module-card";
import { Meter } from "@/components/student/progress-tracker";
import { QuizRunner } from "@/components/student/quiz-runner";
import { PASS_MARK } from "@/lib/student/quiz-bank";
import {
  TEACHING_DAYS_PER_WEEK,
  type StudentJourney,
  type StudentQuiz,
  type StudentWeek,
} from "@/lib/student/progress";

// Student > Learning Path — the student's own course, one week at a time.
// Its length is whatever the course has been authored to, so every count on
// this screen comes from the journey rather than a fixed programme size.
//
// Same shape as the admin content manager (components/admin/content-manager):
// a week rail of pills across the top, the selected week's five days stacked
// below it, then the weekend papers at the bottom. Staff author the programme
// through that layout and students walk it through this one, so keeping the two
// aligned means one mental model of "a week" across the whole product.
//
// What differs is what a week means to each side: the admin rail shows how much
// is published, this one shows how far the student has walked — so the pills
// carry progress state (done / current / locked) rather than authoring state.
//
// Client component: which week is selected is pure view state.

export function LearningPathTimeline({ journey }: { journey: StudentJourney }) {
  const [selected, setSelected] = React.useState(journey.currentWeek);
  const [active, setActive] = React.useState<StudentQuiz | null>(null);

  // Sitting a paper takes over the screen — same runner as the quizzes page, so
  // "Sit paper" opens the paper directly instead of bouncing to /student/quizzes.
  if (active) {
    return <QuizRunner quiz={active} onExit={() => setActive(null)} />;
  }

  const totalDays = journey.totalDays;
  const clamped = Math.min(Math.max(1, selected), journey.weeks.length || 1);
  const week = journey.weeks[clamped - 1];
  const percent =
    totalDays === 0
      ? 0
      : Math.round((journey.daysCompleted / totalDays) * 100);

  // No published curriculum yet — nothing for the student to walk.
  if (!week) {
    return (
      <div>
        <header className="border-b border-border pb-6">
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink">
            Learning path
          </h1>
        </header>
        <div className="py-16 text-center text-sm text-mute">
          Your programme is being prepared. Check back soon — lessons appear here
          as your trainers publish them.
        </div>
      </div>
    );
  }

  const doneDays = week.days.filter((d) => d.state === "done").length;

  return (
    <div>
      {/* Header */}
      <header className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink">
            {journey.course?.title ?? "Learning path"}
          </h1>
          <p className="text-xs sm:text-sm text-body">
            {journey.totalWeeks} weeks · {totalDays} teaching days · {journey.totalWeeks * 2} papers
          </p>
        </div>

        <div className="hidden sm:flex items-center justify-between gap-4 w-full sm:w-auto mt-1 sm:mt-0">
          <div className="text-left sm:text-right">
            <div className="font-display text-2xl font-extrabold text-ink leading-none">
              {percent}%
            </div>
            <div className="mt-1 text-xs text-mute">
              {journey.daysCompleted} / {totalDays} completed
            </div>
          </div>
          <Button onClick={() => setSelected(journey.currentWeek)} size="sm" className="h-9 sm:h-11">
            <CircleDot className="size-4" />
            Today
          </Button>
        </div>
      </header>

      {/* Week rail — numbers only; the week's theme shows in the heading below.
          The marker on each pill says whether the week is behind you, open, or
          still locked, so the rail doubles as the progress map. */}
      <section className="mt-6" aria-label="Weeks">
        <div className="overflow-x-auto pb-1">
          <div className="inline-flex items-center gap-1 rounded-full bg-secondary p-1">
            {journey.weeks.map((w) => (
              <WeekPill
                key={w.weekNumber}
                week={w}
                selected={w.weekNumber === clamped}
                onSelect={() => setSelected(w.weekNumber)}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Selected week */}
      <section className="mt-6" aria-label={`Week ${week.weekNumber}`}>
        <div className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-xl font-extrabold tracking-tight text-ink">
                Week {week.weekNumber} · {week.title}
              </h2>
              {week.state === "current" && <Badge variant="brand">In progress</Badge>}
              {week.state === "done" && <Badge variant="positive">Completed</Badge>}
              {week.state === "locked" && (
                <Badge variant="outline">
                  <Lock className="size-3.5" />
                  Locked
                </Badge>
              )}
            </div>
            <p className="text-sm text-body">{week.focus}</p>
          </div>

          <div className="flex w-40 shrink-0 flex-col gap-1.5">
            <span className="text-xs text-mute">
              {doneDays} of {TEACHING_DAYS_PER_WEEK} days done
            </span>
            <Meter
              percent={(doneDays / TEACHING_DAYS_PER_WEEK) * 100}
              tone={week.state === "done" ? "positive" : "brand"}
              label={`Week ${week.weekNumber} progress`}
            />
          </div>
        </div>

        {/* Weekdays — the full day card each, so the class, the notes and the
            task can all be acted on without leaving the week. */}
        <div className="mt-5 flex flex-col gap-3">
          {week.days.map((day) => (
            <DayModuleCard
              key={day.dayNumber}
              day={day}
              compact
            />
          ))}
        </div>

        {/* Weekend */}
        <div className="mt-8">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-semibold text-ink">Assessments</h3>
            <span className="text-xs text-mute">
              Two assessments · not counted toward the {totalDays}-day path
            </span>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {week.quizzes.map((quiz) => (
              <QuizCard key={quiz.id} quiz={quiz} onSit={() => setActive(quiz)} />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function WeekPill({
  week,
  selected,
  onSelect,
}: {
  week: StudentWeek;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={selected ? "true" : undefined}
      className={cn(
        "flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        selected ? "bg-card text-ink shadow-sm" : "text-body hover:text-ink",
      )}
    >
      {week.state === "done" && <Check className="size-3.5 text-positive" />}
      {week.state === "current" && (
        <span className="size-2 rounded-full bg-primary" aria-hidden />
      )}
      {week.state === "locked" && <Lock className="size-3.5 text-mute" />}
      Week {week.weekNumber}
    </button>
  );
}

/** A weekend paper as it stands for this student — sat, open, missed or locked. */
function QuizCard({ quiz, onSit }: { quiz: StudentQuiz; onSit: () => void }) {
  const passed = (quiz.score ?? 0) >= PASS_MARK;

  return (
    <article className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "grid size-9 shrink-0 place-items-center rounded-lg",
              quiz.state === "done"
                ? "bg-positive-pale text-positive-deep"
                : quiz.state === "open"
                  ? "bg-primary-pale text-ink-deep"
                  : "bg-secondary text-mute",
            )}
          >
            {quiz.state === "locked" ? (
              <Lock className="size-4" />
            ) : (
              <ListChecks className="size-4" />
            )}
          </span>
          <div>
            <div className="text-sm font-semibold text-ink">{quiz.title}</div>
            <div className="text-xs capitalize text-mute">
              {quiz.day === "saturday" ? "Assessment 1" : "Assessment 2"} · {quiz.kind}
            </div>
          </div>
        </div>

        {quiz.state === "done" && quiz.score !== null ? (
          <Badge variant={passed ? "positive" : "warning"}>{quiz.score}%</Badge>
        ) : quiz.state === "missed" ? (
          <Badge variant="negative">Missed</Badge>
        ) : quiz.state === "open" ? (
          <Badge variant="outline">Open now</Badge>
        ) : (
          <Badge variant="outline">Locked</Badge>
        )}
      </div>

      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-mute">{quiz.questionCount} questions</span>
        {quiz.state === "open" || quiz.state === "missed" ? (
          <Button
            variant={quiz.state === "open" ? "tertiary" : "ghost"}
            size="sm"
            onClick={onSit}
          >
            <Play />
            {quiz.state === "missed" ? "Sit late" : "Sit paper"}
          </Button>
        ) : null}
      </div>
    </article>
  );
}
