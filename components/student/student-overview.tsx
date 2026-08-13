"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BookOpenCheck,
  CheckCircle2,
  Flame,
  ListChecks,
  Lock,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  ArrowRight,
  AlertCircle,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";
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
import type { StudentSubmissionItem } from "@/lib/tasks/queries";

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
  submissions = [],
}: {
  name: string;
  journey: StudentJourney;
  submissions?: StudentSubmissionItem[];
}) {
  const todayDay = today(journey);
  const [activeWeekNum, setActiveWeekNum] = React.useState(journey.currentWeek);
  const [selectedDayNumber, setSelectedDayNumber] = React.useState<number | null>(
    todayDay ? todayDay.dayNumber : null
  );

  const router = useRouter();
  const supabase = React.useMemo(() => createClient(), []);

  React.useEffect(() => {
    const channel = supabase
      .channel("student-dashboard-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "task_review_comments" },
        () => router.refresh()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "task_submissions" },
        () => router.refresh()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, router]);

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
            className="text-sm font-semibold text-blue-700 hover:underline"
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
              No class today — you have an assessment waiting.
            </p>
            <Button asChild className="self-start">
              <Link href="/student/quizzes">
                <BookOpenCheck />
                Go to assessments
              </Link>
            </Button>
          </div>
        ) : (
          <p className="rounded-2xl border border-dashed border-border bg-card px-6 py-10 text-center text-sm text-body">
            No class today. Enjoy the break — your next day unlocks soon.
          </p>
        )}
      </section>

      {/* Workspace: Submitted Tasks & Discussions */}
      <section id="discussions" aria-labelledby="discussions-heading" className="flex flex-col gap-4 mt-2">
        <div className="flex items-center justify-between">
          <h2 id="discussions-heading" className="font-display text-lg font-extrabold text-ink">
            My Submissions & Discussions
          </h2>
          <span className="text-xs text-mute font-medium">{submissions.length} submitted</span>
        </div>

        {submissions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card py-10 px-4 text-center">
            <MessageSquare className="mx-auto size-8 text-mute/50 mb-3" />
            <h3 className="text-sm font-semibold text-ink">No homework tasks submitted yet</h3>
            <p className="mx-auto mt-1 max-w-xs text-xs text-mute">
              Your assignments and follow-up trainer discussions will be listed here once you start submitting class tasks.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {submissions.map((sub) => {
              const isRedo = sub.status === "redo";
              const isApproved = sub.status === "approved";

              let badgeVariant: "neutral" | "brand" | "positive" | "negative" = "neutral";
              let badgeText = "Submitted";
              if (isRedo) {
                badgeVariant = "negative";
                badgeText = "Needs Redo";
              } else if (isApproved) {
                badgeVariant = "positive";
                badgeText = "Approved";
              }

              return (
                <div
                  key={sub.submissionId}
                  className={cn(
                    "group flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 transition-all hover:border-primary/20 hover:shadow-xs",
                    isRedo && "border-destructive/20 bg-destructive/[0.02]"
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-mute uppercase tracking-wider">Day {sub.dayNumber}</span>
                        <Badge variant={badgeVariant}>{badgeText}</Badge>
                      </div>
                      <h3 className="mt-1 font-display font-bold text-ink text-sm sm:text-base truncate group-hover:text-primary transition-colors">
                        {sub.taskTitle}
                      </h3>
                    </div>
                    {sub.commentCount > 0 && (
                      <div className="flex items-center gap-1 shrink-0 rounded-full bg-secondary px-2 py-0.5 text-xs text-body font-semibold">
                        <MessageSquare className="size-3 text-mute" />
                        <span>{sub.commentCount}</span>
                      </div>
                    )}
                  </div>

                  {sub.latestComment ? (
                    <div className="rounded-xl bg-secondary/35 p-3 text-xs text-body border border-border/10">
                      <div className="flex items-center justify-between font-semibold text-ink-deep mb-1">
                        <span>{sub.latestComment.authorName}</span>
                        <span className="text-[10px] font-normal text-mute">{sub.latestComment.sentAt}</span>
                      </div>
                      <p className="line-clamp-2 italic text-body/90 leading-relaxed">
                        &ldquo;{sub.latestComment.body}&rdquo;
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs text-mute italic">No messages in this discussion yet.</p>
                  )}

                  <div className="flex items-center justify-between gap-3 border-t border-border/30 pt-3 mt-1">
                    <span className="text-xs text-mute">
                      Sent {sub.submittedAt}
                    </span>
                    <Button
                      asChild
                      size="sm"
                      variant={isRedo ? "soft" : "secondary"}
                      className="h-8 rounded-lg text-xs font-bold"
                    >
                      <Link href={`/student/learning-path/${sub.dayNumber}?tab=task${sub.latestComment?.questionId ? `&q=${sub.latestComment.questionId}` : ""}#discussion`}>
                        {isRedo ? "Resubmit Task" : sub.commentCount > 0 ? "Reply to Trainer" : "Open Chat"}
                        <ArrowRight className="size-3.5 ml-1 transition-transform group-hover:translate-x-0.5" />
                      </Link>
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
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
    <div className="flex items-center justify-between gap-1.5 w-full bg-secondary/10 p-1.5 rounded-full border border-white/5">
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
        <span className="flex items-center justify-center h-9 sm:h-10 px-4 sm:px-5 rounded-full text-xs sm:text-sm font-extrabold whitespace-nowrap bg-[#043556] text-white shadow-[0_4px_12px_rgba(4,53,86,0.25)] border border-[#043556]/20 transition-all scale-102">
          Day {day.dayNumber}
        </span>
      </PillFrame>
    );
  }

  const circle = day.state === "today"
    ? "bg-primary-pale text-primary border border-primary/20"
    : day.state === "done"
      ? "bg-emerald-50 text-emerald-700 border border-emerald-200/50"
      : "bg-secondary/40 text-mute border border-border/40";

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
      ? "bg-[#043556] text-white font-extrabold shadow-[0_4px_12px_rgba(4,53,86,0.3)]"
      : state === "missed"
        ? "bg-destructive/10 text-destructive border border-destructive/20"
        : "bg-secondary/40 text-mute border border-border/40";

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
}: {
  currentDay: number;
  totalDays: number;
  daysCompleted: number;
  percent: number;
  streakDays: number;
}) {
  return (
    <section
      aria-label="Your progress"
      className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-sm flex items-center gap-5 sm:gap-6 min-h-[140px] sm:min-h-[160px]"
    >
      {/* Soft brand gradient wash in the corner. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-8 -top-10 size-40 rounded-full bg-linear-to-br from-primary-pale to-transparent blur-2xl"
      />

      {/* Left side character illustration */}
      <div className="shrink-0 flex items-end select-none relative z-10">
        <img
          src="/student-character.png"
          alt="Student illustration"
          className="h-24 sm:h-32 w-auto object-contain transform translate-y-2 sm:translate-y-4"
        />
      </div>

      {/* Right side content */}
      <div className="flex-1 min-w-0 relative z-10">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="font-display text-lg sm:text-2xl font-extrabold text-ink leading-tight">
              Day {currentDay} of {totalDays}
            </div>
            <p className="mt-0.5 text-xs sm:text-sm text-mute">
              {daysCompleted} {daysCompleted === 1 ? "day" : "days"} completed
            </p>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-primary-pale px-2 sm:px-2.5 py-0.5 sm:py-1 text-xs sm:text-sm font-semibold text-ink-deep shrink-0">
            <Flame className="size-3.5 sm:size-4" />
            {streakDays}
          </span>
        </div>

        {/* Progress bar */}
        <div className="mt-3">
          <div className="h-2 sm:h-2.5 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-[#043556]"
              style={{ width: `${percent}%` }}
            />
          </div>
          <div className="mt-1.5 flex items-center justify-between text-[11px] sm:text-xs text-mute font-medium">
            <span>{percent}% complete</span>
            <span>{totalDays - daysCompleted} to go</span>
          </div>
        </div>
      </div>
    </section>
  );
}
