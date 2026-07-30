"use client";

import { useState } from "react";
import Link from "next/link";
import {
  BookOpenCheck,
  CheckCircle2,
  Flame,
  ListChecks,
  Lock,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { DayModuleCard } from "@/components/student/day-module-card";
import {
  awaitingReview,
  needsRedo,
  openQuizzes,
  today,
  type StudentDay,
  type StudentJourney,
  type StudentQuiz,
  type StudentWeek,
} from "@/lib/student/progress";

// Student home — mobile-first. The order answers a learner's morning questions
// top to bottom: who am I greeting, where in the week am I, how's my task/review
// standing, and what do I do today. Designed for a phone; it simply centers into
// a comfortable column on larger screens.

function greetingFor(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function StudentOverview({
  name,
  journey,
}: {
  name: string;
  journey: StudentJourney;
}) {
  const todayDay = today(journey);
  const [activeWeekNum, setActiveWeekNum] = useState(journey.currentWeek);
  const [selectedDayNumber, setSelectedDayNumber] = useState<number | null>(
    todayDay ? todayDay.dayNumber : null
  );

  const activeWeek = journey.weeks[activeWeekNum - 1];
  const waiting = awaitingReview(journey);
  const redo = needsRedo(journey);
  const openPapers = openQuizzes(journey);
  const percent =
    journey.totalDays === 0
      ? 0
      : Math.round((journey.daysCompleted / journey.totalDays) * 100);
  const greeting = greetingFor(new Date().getHours());

  const selectedDay = selectedDayNumber
    ? journey.weeks.flatMap((w) => w.days).find((d) => d.dayNumber === selectedDayNumber)
    : null;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      {/* Header */}
      <header className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate font-display text-2xl font-extrabold tracking-tight text-ink">
            {greeting}, {name}
          </h1>
          <p className="truncate text-sm text-body">
            Week {activeWeekNum} of {journey.totalWeeks}{activeWeek ? ` · ${activeWeek.title}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            variant="outline"
            size="icon"
            disabled={activeWeekNum === 1}
            onClick={() => {
              const nextWeek = activeWeekNum - 1;
              setActiveWeekNum(nextWeek);
              const wk = journey.weeks[nextWeek - 1];
              if (wk && wk.days.length > 0) {
                const firstUnlocked = wk.days.find(d => d.state !== "locked") ?? wk.days[0];
                setSelectedDayNumber(firstUnlocked.dayNumber);
              } else {
                setSelectedDayNumber(null);
              }
            }}
            className="size-9 rounded-full bg-card hover:bg-muted text-ink border border-border"
            title="Previous week"
          >
            <ChevronLeft className="size-5" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            disabled={activeWeekNum === journey.totalWeeks}
            onClick={() => {
              const nextWeek = activeWeekNum + 1;
              setActiveWeekNum(nextWeek);
              const wk = journey.weeks[nextWeek - 1];
              if (wk && wk.days.length > 0) {
                const firstUnlocked = wk.days.find(d => d.state !== "locked") ?? wk.days[0];
                setSelectedDayNumber(firstUnlocked.dayNumber);
              } else {
                setSelectedDayNumber(null);
              }
            }}
            className="size-9 rounded-full bg-card hover:bg-muted text-ink border border-border"
            title="Next week"
          >
            <ChevronRight className="size-5" />
          </Button>
        </div>
      </header>

      {/* Weekly day strip */}
      {activeWeek ? (
        <WeekStrip
          week={activeWeek}
          selectedDayNumber={selectedDayNumber}
          onSelectDay={setSelectedDayNumber}
        />
      ) : null}

      {/* Progress + task-review hero */}
      <ProgressHero
        currentDay={journey.currentDay}
        totalDays={journey.totalDays}
        daysCompleted={journey.daysCompleted}
        percent={percent}
        streakDays={journey.streakDays}
        waiting={waiting.length}
        redo={redo.length}
      />

      {/* Today's day */}
      <section aria-labelledby="today-heading" className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2
            id="today-heading"
            className="font-display text-lg font-extrabold text-ink"
          >
            {selectedDay
              ? selectedDay.dayNumber === todayDay?.dayNumber
                ? "Today's class"
                : `Class for Day ${selectedDay.dayNumber}`
              : todayDay
                ? "Today's class"
                : "This week"}
          </h2>
          <Link
            href="/student/learning-path"
            className="text-sm font-semibold text-brand-green hover:underline"
          >
            Learning path
          </Link>
        </div>

        {selectedDay ? (
          <DayModuleCard day={selectedDay} />
        ) : todayDay ? (
          <DayModuleCard day={todayDay} />
        ) : openPapers.length > 0 ? (
          <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5">
            <p className="text-sm text-body">
              No class today — you have a weekend paper waiting.
            </p>
            <Button asChild className="self-start">
              <Link href="/student/quizzes">
                <BookOpenCheck />
                Go to papers
              </Link>
            </Button>
          </div>
        ) : (
          <p className="rounded-2xl border border-dashed border-border bg-card px-6 py-10 text-center text-sm text-body">
            No class today. Enjoy the break — your next day unlocks soon.
          </p>
        )}
      </section>
    </div>
  );
}

/**
 * The week at a glance: five teaching days (Mon–Fri) plus the two weekend
 * assessment papers (Sat, Sun). Seven columns, always fitting the width.
 */
function WeekStrip({
  week,
  selectedDayNumber,
  onSelectDay,
}: {
  week: StudentWeek;
  selectedDayNumber: number | null;
  onSelectDay: (num: number) => void;
}) {
  const sat = week.quizzes.find((q) => q.day === "saturday");
  const sun = week.quizzes.find((q) => q.day === "sunday");

  return (
    <div className="flex items-center justify-between gap-1.5 w-full bg-secondary/10 p-1.5 rounded-fullborder border-white/5">
      {week.days.map((d) => (
        <DayPill
          key={d.dayNumber}
          day={d}
          selected={d.dayNumber === selectedDayNumber}
          onSelect={() => onSelectDay(d.dayNumber)}
        />
      ))}
      <QuizPill quiz={sat} />
      <QuizPill quiz={sun} />
    </div>
  );
}

function PillFrame({
  href,
  current,
  onClick,
  children,
}: {
  href: string | null;
  current?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  const className = "flex flex-col items-center cursor-pointer";
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-current={current ? "page" : undefined}
        className={className}
      >
        {children}
      </button>
    );
  }
  return href ? (
    <Link
      href={href}
      aria-current={current ? "page" : undefined}
      className={className}
    >
      {children}
    </Link>
  ) : (
    <div className={className} aria-disabled>
      {children}
    </div>
  );
}

function DayPill({
  day,
  selected,
  onSelect,
}: {
  day: StudentDay;
  selected: boolean;
  onSelect: () => void;
}) {
  const locked = day.state === "locked";

  if (selected) {
    return (
      <PillFrame href={null} onClick={locked ? undefined : onSelect}>
        <span className="flex items-center justify-center h-9 sm:h-10 px-4 sm:px-5 rounded-full text-xs sm:text-sm font-extrabold whitespace-nowrap bg-gradient-to-r from-orange-500 to-rose-500 text-white shadow-[0_0_15px_rgba(249,115,22,0.4)] border border-orange-400/30 transition-all scale-102">
          Day {day.dayNumber}
        </span>
      </PillFrame>
    );
  }

  const circle = day.state === "today"
    ? "bg-primary-pale text-primary border border-primary/20"
    : day.state === "done"
      ? "bg-[#181a25]/60 text-ink/80 border border-white/5"
      : "bg-secondary/40 text-mute border border-white/5";

  return (
    <PillFrame href={null} onClick={locked ? undefined : onSelect}>
      <span
        className={cn(
          "grid size-9 sm:size-10 place-items-center rounded-full text-xs sm:text-sm font-bold transition-all",
          circle,
        )}
      >
        {locked ? <Lock className="size-3.5" /> : day.dayNumber}
      </span>
    </PillFrame>
  );
}

function QuizPill({ quiz }: { quiz: StudentQuiz | undefined }) {
  const state = quiz?.state ?? "locked";
  const circle = state === "done"
    ? "bg-positive-pale text-positive-deep border border-positive/10"
    : state === "open"
      ? "bg-gradient-to-r from-orange-500 to-rose-500 text-white font-extrabold shadow-[0_0_15px_rgba(249,115,22,0.55)]"
      : state === "missed"
        ? "bg-destructive/10 text-destructive border border-destructive/20"
        : "bg-secondary/40 text-mute border border-white/5";

  return (
    <PillFrame
      href={
        quiz && state !== "locked"
          ? `/student/quizzes?start=${quiz.id}&week=${quiz.weekNumber}&day=${quiz.day}`
          : quiz
            ? "/student/quizzes"
            : null
      }
      current={state === "open"}
    >
      <span
        className={cn(
          "grid size-9 place-items-center rounded-full transition-all sm:size-10",
          circle,
        )}
      >
        {state === "locked" ? (
          <Lock className="size-4" />
        ) : (
          <ListChecks className="size-4.5 text-emerald-400" />
        )}
      </span>
    </PillFrame>
  );
}

/** The brand hero: overall progress + at-a-glance task-review standing. */
function ProgressHero({
  currentDay,
  totalDays,
  daysCompleted,
  percent,
  streakDays,
  waiting,
  redo,
}: {
  currentDay: number;
  totalDays: number;
  daysCompleted: number;
  percent: number;
  streakDays: number;
  waiting: number;
  redo: number;
}) {
  const review =
    redo > 0
      ? { label: `${redo} ${redo === 1 ? "task needs" : "tasks need"} another go`, tone: "warn" }
      : waiting > 0
        ? { label: `${waiting} ${waiting === 1 ? "task" : "tasks"} with your trainer`, tone: "wait" }
        : { label: "You're all caught up", tone: "ok" };

  return (
    <section
      aria-label="Your progress"
      className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-sm"
    >
      {/* Soft brand gradient wash in the corner. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-8 -top-10 size-40 rounded-full bg-linear-to-br from-primary-pale to-transparent blur-2xl"
      />

      <div className="relative">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="font-display text-2xl font-extrabold text-ink">
              Day {currentDay} of {totalDays}
            </div>
            <p className="mt-0.5 text-sm text-mute">
              {daysCompleted} {daysCompleted === 1 ? "day" : "days"} completed
            </p>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-primary-pale px-2.5 py-1 text-sm font-semibold text-ink-deep">
            <Flame className="size-4" />
            {streakDays}
          </span>
        </div>

        {/* Progress bar */}
        <div className="mt-4">
          <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${percent}%` }}
            />
          </div>
          <div className="mt-1.5 flex items-center justify-between text-xs text-mute">
            <span>{percent}% complete</span>
            <span>{totalDays - daysCompleted} to go</span>
          </div>
        </div>

        {/* Task review standing */}
        <div className="mt-4 flex items-center gap-2 rounded-xl bg-muted px-3 py-2.5 text-sm text-body">
          <CheckCircle2 className="size-4 shrink-0 text-brand-green" />
          <span className="min-w-0 flex-1 truncate">{review.label}</span>
          <Link
            href="/student/learning-path"
            className="shrink-0 font-semibold text-brand-green underline-offset-2 hover:underline"
          >
            View
          </Link>
        </div>
      </div>
    </section>
  );
}
