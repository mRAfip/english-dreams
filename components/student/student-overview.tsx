"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
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
  banner = null,
}: {
  name: string;
  journey: StudentJourney;
  submissions?: StudentSubmissionItem[];
  banner?: { banner_key: string; banner_url: string } | null;
}) {
  const todayDay = today(journey);
  const [activeWeekNum, setActiveWeekNum] = React.useState(journey.currentWeek);

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
  const sat = activeWeek?.quizzes.find((q) => q.day === "saturday");
  const sun = activeWeek?.quizzes.find((q) => q.day === "sunday");
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
      <header className="flex mt-6 items-center justify-between gap-3">
        <div className="min-w-0 flex flex-col">
          <span className="text-lg uppercase text-body/80">
            Hi, {name}!
          </span>
          <h1 className="truncate font-display text-2xl font-extrabold tracking-tight text-ink mt-0.5">
            Ready to learn
          </h1>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            variant="outline"
            size="icon"
            disabled={activeWeekNum === 1}
            onClick={() => setActiveWeekNum(activeWeekNum - 1)}
            className="size-9 rounded-full bg-card hover:bg-muted text-ink border border-border nav-glass-btn"
            title="Previous week"
          >
            <ChevronLeft className="size-5" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            disabled={activeWeekNum === journey.totalWeeks}
            onClick={() => setActiveWeekNum(activeWeekNum + 1)}
            className="size-9 rounded-full bg-card hover:bg-muted text-ink border border-border nav-glass-btn"
            title="Next week"
          >
            <ChevronRight className="size-5" />
          </Button>
        </div>
      </header>

      {/* Progress + task-review hero */}
      <ProgressHero
        currentDay={journey.currentDay}
        totalDays={journey.totalDays}
        daysCompleted={journey.daysCompleted}
        percent={percent}
        streakDays={journey.streakDays}
      />

      {banner && (
        <div className="relative w-full aspect-[3/1] sm:aspect-[4/1] rounded-xl overflow-hidden border border-border/50 shadow-sm bg-card transition-all hover:shadow-md">
          <img
            src={banner.banner_url}
            alt="English Dreams Banner"
            className="absolute inset-0 w-full h-full object-cover"
          />
        </div>
      )}

      {/* Today's day / Day Picker Card */}
      <section aria-labelledby="today-heading" className="flex flex-col gap-3">
        <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
          {/* Card Header */}
          <div className="p-5 border-b border-border flex items-center justify-between">
            <div>
              <h3 id="today-heading" className="font-display text-base font-bold text-ink">
                {journey.totalDays} Days Class
              </h3>
              <p className="text-xs text-mute mt-0.5">Week {activeWeekNum} of {journey.totalWeeks} · Please Select Your Day</p>
            </div>
          </div>

          {/* Day Selector Area */}
          {activeWeek && (
            <div className="p-5">
              <div className="flex items-center justify-between gap-1.5 w-full bg-secondary/5 p-1.5 rounded-lg border border-border/20">
                {activeWeek.days.map((d) => (
                  <DayPill
                    key={d.dayNumber}
                    day={d}
                    onSelect={() => {
                      if (d.state !== "locked") {
                        router.push(`/student/learning-path/${d.dayNumber}`);
                      }
                    }}
                  />
                ))}
                {sat && (
                  <QuizPill
                    quiz={sat}
                    onSelect={() => {
                      if (sat.state !== "locked" && sat.quizId) {
                        router.push(`/student/quizzes?start=${sat.id}&week=${sat.weekNumber}&day=${sat.day}`);
                      } else {
                        router.push("/student/quizzes");
                      }
                    }}
                  />
                )}
                {sun && (
                  <QuizPill
                    quiz={sun}
                    onSelect={() => {
                      if (sun.state !== "locked" && sun.quizId) {
                        router.push(`/student/quizzes?start=${sun.id}&week=${sun.weekNumber}&day=${sun.day}`);
                      } else {
                        router.push("/student/quizzes");
                      }
                    }}
                  />
                )}
              </div>
            </div>
          )}

          {/* Course Status Block */}
          <div className="px-5 pb-5">
            <div className="bg-primary-pale border border-primary/10 rounded-xl p-4 flex items-center justify-between">
              <div className="min-w-0">
                <h4 className="font-semibold text-primary text-sm flex items-center gap-2">
                  {journey.course?.title || "English Dreams Course"}
                  <span className="bg-emerald-500 text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                    Active
                  </span>
                </h4>
                <p className="text-xs text-mute mt-1">
                  Please Select Your Day
                </p>
              </div>
              <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <BookOpenCheck className="size-5 text-primary" />
              </div>
            </div>
          </div>
        </div>
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
          <div className="divide-y divide-border border border-border bg-card rounded-2xl overflow-hidden shadow-xs">
            {submissions.map((sub) => {
              const isRedo = sub.status === "redo";
              const isApproved = sub.status === "approved";

              let badgeText = "Submitted";
              let badgeColor = "bg-secondary/30 text-body";
              if (isRedo) {
                badgeText = "Needs Redo";
                badgeColor = "bg-destructive/10 text-destructive";
              } else if (isApproved) {
                badgeText = "Approved";
                badgeColor = "bg-emerald-500/10 text-emerald-700";
              }

              return (
                <Link
                  key={sub.submissionId}
                  href={`/student/learning-path/${sub.dayNumber}?tab=task${sub.latestComment?.questionId ? `&q=${sub.latestComment.questionId}` : ""}#discussion`}
                  className={cn(
                    "group flex items-start gap-4 p-4 hover:bg-muted/10 transition-colors",
                    isRedo && "bg-destructive/[0.01]"
                  )}
                >
                  {/* Day Circle */}
                  <div className={cn(
                    "grid size-9 place-items-center rounded-xl font-bold text-xs shrink-0 select-none",
                    isRedo
                      ? "bg-destructive/10 text-destructive"
                      : isApproved
                        ? "bg-emerald-500/10 text-emerald-700"
                        : "bg-secondary/20 text-body"
                  )}>
                    D{sub.dayNumber}
                  </div>

                  {/* Info details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-ink text-sm sm:text-base group-hover:text-primary transition-colors truncate">
                        {sub.taskTitle}
                      </h4>
                      <span className={cn(
                        "inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider",
                        badgeColor
                      )}>
                        {badgeText}
                      </span>
                    </div>

                    {sub.latestComment ? (
                      <p className="mt-1 text-xs text-mute truncate max-w-xl">
                        <span className="font-medium text-ink/70">{sub.latestComment.authorName}:</span>{" "}
                        &ldquo;{sub.latestComment.body}&rdquo;
                      </p>
                    ) : (
                      <p className="mt-1 text-xs text-mute/50 italic">No messages yet</p>
                    )}

                    <span className="inline-block mt-2 text-[10px] text-mute/50">
                      Sent {sub.submittedAt}
                    </span>
                  </div>

                  {/* Comment count & Arrow */}
                  <div className="flex items-center gap-2 shrink-0 self-center">
                    {sub.commentCount > 0 && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-mute bg-secondary/15 px-2 py-0.5 rounded-full">
                        <MessageSquare className="size-3 text-mute/60" />
                        {sub.commentCount}
                      </span>
                    )}
                    <ArrowRight className="size-4 text-mute/40 transition-transform group-hover:translate-x-0.5" />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
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
  onSelect,
}: {
  day: StudentDay;
  onSelect: () => void;
}) {
  const locked = day.state === "locked";

  const circle = day.state === "today"
    ? "bg-[#b71a12] text-white font-extrabold border border-[#b71a12]/20 shadow-[0_2px_8px_rgba(183,26,18,0.25)]"
    : day.state === "done"
      ? "bg-emerald-600 text-white border border-emerald-700/20"
      : "bg-white text-ink border border-border/80";

  return (
    <PillFrame href={null} onClick={locked ? undefined : onSelect}>
      <span
        className={cn(
          "grid size-10 place-items-center rounded-lg text-sm font-extrabold transition-all hover:scale-105 select-none",
          circle,
          locked && "opacity-60 bg-muted/30 text-mute border-dashed border-border"
        )}
      >
        {locked ? (
          <Lock className="size-4 text-mute/60" />
        ) : (
          day.dayNumber
        )}
      </span>
    </PillFrame>
  );
}

function QuizPill({
  quiz,
  onSelect,
}: {
  quiz: StudentQuiz | undefined;
  onSelect: () => void;
}) {
  if (!quiz) return null;
  const state = quiz.state;
  const locked = state === "locked";

  const circle = state === "done" || state === "open"
    ? "bg-[#043556] text-white font-extrabold border border-[#043556]/20 shadow-[0_2px_8px_rgba(4,53,86,0.25)]"
    : "bg-white text-ink border border-border/80";

  return (
    <PillFrame href={null} onClick={locked ? undefined : onSelect}>
      <span
        className={cn(
          "grid size-10 place-items-center rounded-lg transition-all hover:scale-105 select-none",
          circle,
          locked && "opacity-60 bg-muted/30 text-mute border-dashed border-border"
        )}
        title={quiz.title}
      >
        {locked ? (
          <Lock className="size-4 text-mute/60" />
        ) : (
          <ListChecks className="size-4.5" />
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
