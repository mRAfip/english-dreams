"use client";

import * as React from "react";
import {
  CalendarClock,
  Check,
  ListChecks,
  Lock,
  Play,
  Timer,
  TrendingUp,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Meter, StatTile } from "@/components/student/progress-tracker";
import { QuizRunner } from "@/components/student/quiz-runner";
import { PASS_MARK, quizDurationSec } from "@/lib/student/quiz-bank";
import {
  allQuizzes,
  quizAverage,
  type StudentJourney,
  type StudentQuiz,
  type StudentWeek,
} from "@/lib/student/progress";

// Student > Quizzes — the weekend papers, one week at a time.
//
// Papers are a weekly thing: two close every week — a Saturday practice run and
// the Sunday graded assessment — so the board is built on the same week rail as
// the learning path (components/student/learning-path-timeline). Pick a week,
// see its two papers. Consistent with how the whole programme is navigated.
//
// A summary row of numbers sits above the rail, because "how am I doing across
// all the papers" is the second question a student has after "what can I sit".
//
// Sitting a paper takes over the whole page rather than opening a dialog: an
// assessment deserves the student's full attention, it is timed, and a modal
// that Escape can dismiss mid-paper is a bad place to keep answers.

export function QuizBoard({ journey }: { journey: StudentJourney }) {
  const [active, setActive] = React.useState<StudentQuiz | null>(null);
  const [selected, setSelected] = React.useState(journey.currentWeek);

  const quizzes = allQuizzes(journey);
  const done = quizzes.filter((q) => q.state === "done");
  const open = quizzes.filter((q) => q.state === "open");
  const missed = quizzes.filter((q) => q.state === "missed");

  const average = quizAverage(journey);
  const best = done.reduce((max, q) => Math.max(max, q.score ?? 0), 0);
  const passed = done.filter((q) => (q.score ?? 0) >= PASS_MARK).length;

  const week = journey.weeks[selected - 1];

  // No published curriculum yet — there are no papers to sit.
  if (journey.weeks.length === 0 || !week) {
    return (
      <div>
        <header className="border-b border-border pb-6">
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink">
            Weekend papers
          </h1>
        </header>
        <div className="py-16 text-center text-sm text-mute">
          Your assessments will appear here once your programme content is
          published.
        </div>
      </div>
    );
  }

  if (active) {
    return <QuizRunner quiz={active} onExit={() => setActive(null)} />;
  }

  return (
    <div>
      {/* Header */}
      <header className="flex flex-col gap-5 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1.5">
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink">
            Weekend papers
          </h1>
          <p className="text-sm text-body">
            Two papers a week — a practice run on Saturday, the graded assessment
            on Sunday. Each one is timed. Pass mark is {PASS_MARK}%.
          </p>
        </div>
      </header>

      {/* Numbers across every week */}
      <section
        aria-label="Your assessment record"
        className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        <StatTile
          label="Open now"
          value={String(open.length)}
          hint={open.length === 0 ? "nothing to sit today" : "waiting for you"}
          tone={open.length > 0 ? "warning" : "neutral"}
          icon={CalendarClock}
        />
        <StatTile
          label="Average"
          value={average === null ? "—" : `${average}%`}
          hint={`across ${done.length} sat ${done.length === 1 ? "paper" : "papers"}`}
          tone={average !== null && average >= PASS_MARK ? "positive" : "neutral"}
          icon={TrendingUp}
        />
        <StatTile
          label="Best score"
          value={done.length === 0 ? "—" : `${best}%`}
          hint={`${passed} of ${done.length} passed`}
          tone={done.length > 0 ? "positive" : "neutral"}
          icon={ListChecks}
        />
        <StatTile
          label="Missed"
          value={String(missed.length)}
          hint={missed.length === 0 ? "you've sat every paper" : "papers you skipped"}
          tone={missed.length === 0 ? "positive" : "negative"}
          icon={XCircle}
        />
      </section>

      {/* Week rail — same control as the learning path. The marker shows whether
          that week's papers are behind you, open, or still locked. */}
      <section className="mt-6" aria-label="Weeks">
        <div className="overflow-x-auto pb-1">
          <div className="inline-flex items-center gap-1 rounded-full bg-secondary p-1">
            {journey.weeks.map((w) => (
              <WeekPill
                key={w.weekNumber}
                week={w}
                selected={w.weekNumber === selected}
                onSelect={() => setSelected(w.weekNumber)}
              />
            ))}
          </div>
        </div>
      </section>

      {/* The selected week's two papers */}
      <section className="mt-6" aria-label={`Week ${week.weekNumber} papers`}>
        <div className="flex flex-col gap-1 border-b border-border pb-4">
          <h2 className="font-display text-xl font-extrabold tracking-tight text-ink">
            Week {week.weekNumber} · {week.title}
          </h2>
          <p className="text-sm text-body">
            {week.state === "locked"
              ? "These papers unlock when you reach this week."
              : "Sit the practice first, then the graded assessment."}
          </p>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {week.quizzes.map((quiz) => (
            <QuizCard key={quiz.id} quiz={quiz} onSit={setActive} />
          ))}
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
  const open = week.quizzes.some((q) => q.state === "open");

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
      {open && <span className="size-2 rounded-full bg-primary" aria-hidden />}
      {week.state === "locked" && !open && <Lock className="size-3.5 text-mute" />}
      Week {week.weekNumber}
    </button>
  );
}

/** One weekend paper as it stands for this student — sat, open, missed or locked. */
function QuizCard({
  quiz,
  onSit,
}: {
  quiz: StudentQuiz;
  onSit: (quiz: StudentQuiz) => void;
}) {
  const graded = quiz.kind === "assessment";
  const passed = (quiz.score ?? 0) >= PASS_MARK;
  const minutes = Math.round(quizDurationSec(quiz) / 60);

  return (
    <article
      className={cn(
        "flex flex-col gap-4 rounded-xl border bg-card p-5",
        quiz.state === "open" ? "border-ink" : "border-border",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className={cn(
              "grid size-10 shrink-0 place-items-center rounded-lg",
              quiz.state === "done"
                ? "bg-primary-pale text-positive-deep"
                : quiz.state === "open"
                  ? "bg-primary text-primary-foreground"
                  : quiz.state === "missed"
                    ? "bg-destructive/10 text-destructive"
                    : "bg-secondary text-mute",
            )}
          >
            {quiz.state === "locked" ? (
              <Lock className="size-4" />
            ) : quiz.state === "missed" ? (
              <XCircle className="size-4" />
            ) : (
              <ListChecks className="size-4" />
            )}
          </span>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-ink">{quiz.title}</div>
            <div className="text-xs capitalize text-mute">
              {quiz.day} · {graded ? "graded" : "practice"}
            </div>
          </div>
        </div>

        <Badge variant={graded ? "brand" : "neutral"}>
          {graded ? "Graded" : "Practice"}
        </Badge>
      </div>

      {/* The paper's shape: how many questions, how long. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-mute">
        <span className="flex items-center gap-1">
          <ListChecks className="size-3.5" />
          {quiz.questionCount} questions
        </span>
        <span className="flex items-center gap-1">
          <Timer className="size-3.5" />
          {minutes} min limit
        </span>
      </div>

      {quiz.state === "done" && quiz.score !== null && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-xs text-mute">Your score</span>
            <span
              className={cn(
                "font-display text-xl font-extrabold tabular-nums",
                passed ? "text-ink" : "text-warning-deep",
              )}
            >
              {quiz.score}%
            </span>
          </div>
          <Meter
            percent={quiz.score}
            tone={passed ? "positive" : "warning"}
            label={`${quiz.title} score`}
          />
        </div>
      )}

      {/* The action, whatever the paper's state allows. */}
      <div className="mt-auto flex items-center justify-between gap-3">
        {quiz.state === "open" ? (
          <span className="text-xs font-semibold text-ink">Ready to sit</span>
        ) : quiz.state === "missed" ? (
          <span className="text-xs text-destructive">
            Missed — no longer counts toward your average
          </span>
        ) : quiz.state === "locked" ? (
          <span className="text-xs text-mute">Locked</span>
        ) : (
          <span className="text-xs text-positive-deep">
            {passed ? "Passed" : "Below pass mark"}
          </span>
        )}

        {quiz.state === "open" && (
          <Button size="sm" onClick={() => onSit(quiz)}>
            <Play />
            Sit paper
          </Button>
        )}
        {quiz.state === "missed" && (
          <Button size="sm" variant="secondary" onClick={() => onSit(quiz)}>
            <Play />
            Sit late
          </Button>
        )}
        {quiz.state === "done" && quiz.kind === "practice" && (
          <Button size="sm" variant="tertiary" onClick={() => onSit(quiz)}>
            Retake
          </Button>
        )}
      </div>
    </article>
  );
}
