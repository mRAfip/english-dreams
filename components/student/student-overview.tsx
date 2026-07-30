import Link from "next/link";
import {
  BookOpenCheck,
  CheckCircle2,
  Flame,
  ListChecks,
  Lock,
  MessageSquare,
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

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];

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
  const day = today(journey);
  const week = journey.weeks[journey.currentWeek - 1];
  const waiting = awaitingReview(journey);
  const redo = needsRedo(journey);
  const openPapers = openQuizzes(journey);
  const percent =
    journey.totalDays === 0
      ? 0
      : Math.round((journey.daysCompleted / journey.totalDays) * 100);
  const greeting = greetingFor(new Date().getHours());

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      {/* Header */}
      <header className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate font-display text-2xl font-extrabold tracking-tight text-ink">
            {greeting}, {name}
          </h1>
          <p className="truncate text-sm text-body">
            Week {journey.currentWeek} of {journey.totalWeeks}
            {week ? ` · ${week.title}` : ""}
          </p>
        </div>
        <Link
          href="/inbox"
          aria-label="Messages"
          className="grid size-11 shrink-0 place-items-center rounded-full border border-border bg-card text-ink transition-colors hover:bg-muted"
        >
          <MessageSquare className="size-5" />
        </Link>
      </header>

      {/* Weekly day strip */}
      {week ? <WeekStrip week={week} /> : null}

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
            {day ? "Today's class" : "This week"}
          </h2>
          <Link
            href="/student/learning-path"
            className="text-sm font-semibold text-brand-green hover:underline"
          >
            Learning path
          </Link>
        </div>

        {day ? (
          <DayModuleCard day={day} />
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
function WeekStrip({ week }: { week: StudentWeek }) {
  const sat = week.quizzes.find((q) => q.day === "saturday");
  const sun = week.quizzes.find((q) => q.day === "sunday");

  return (
    <div className="grid grid-cols-7 gap-1">
      {week.days.map((d) => (
        <DayPill key={d.dayNumber} label={WEEKDAYS[d.weekday - 1] ?? ""} day={d} />
      ))}
      <QuizPill label="Sat" quiz={sat} />
      <QuizPill label="Sun" quiz={sun} />
    </div>
  );
}

function PillFrame({
  label,
  href,
  current,
  children,
}: {
  label: string;
  href: string | null;
  current?: boolean;
  children: React.ReactNode;
}) {
  const className = "flex flex-col items-center gap-1.5";
  const inner = (
    <>
      <span className="text-[10px] font-medium text-mute">{label}</span>
      {children}
    </>
  );
  return href ? (
    <Link
      href={href}
      aria-current={current ? "page" : undefined}
      className={className}
    >
      {inner}
    </Link>
  ) : (
    <div className={className} aria-disabled>
      {inner}
    </div>
  );
}

function DayPill({ label, day }: { label: string; day: StudentDay }) {
  const locked = day.state === "locked";
  const circle =
    day.state === "today"
      ? "bg-primary text-primary-foreground shadow-sm"
      : day.state === "done"
        ? "bg-primary-pale text-ink-deep"
        : "bg-secondary text-mute";

  return (
    <PillFrame
      label={label}
      href={locked ? null : `/student/learning-path/${day.dayNumber}`}
      current={day.state === "today"}
    >
      <span
        className={cn(
          "grid size-9 place-items-center rounded-full text-sm font-bold transition-colors sm:size-10",
          circle,
        )}
      >
        {locked ? <Lock className="size-4" /> : day.dayNumber}
      </span>
    </PillFrame>
  );
}

function QuizPill({ label, quiz }: { label: string; quiz: StudentQuiz | undefined }) {
  const state = quiz?.state ?? "locked";
  const circle =
    state === "done"
      ? "bg-positive-pale text-positive-deep"
      : state === "open"
        ? "bg-primary text-primary-foreground shadow-sm"
        : state === "missed"
          ? "bg-destructive/10 text-destructive"
          : "bg-secondary text-mute";

  return (
    <PillFrame label={label} href={quiz ? "/student/quizzes" : null}>
      <span
        className={cn(
          "grid size-9 place-items-center rounded-full transition-colors sm:size-10",
          circle,
        )}
        title={quiz ? "Weekend paper" : undefined}
      >
        {state === "locked" ? (
          <Lock className="size-4" />
        ) : (
          <ListChecks className="size-4" />
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
