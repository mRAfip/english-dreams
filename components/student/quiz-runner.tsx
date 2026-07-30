"use client";

import * as React from "react";
import {
  AlarmClock,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Loader2,
  RotateCcw,
  Send,
  Timer,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Meter } from "@/components/student/progress-tracker";
import { PASS_MARK, quizDurationSec } from "@/lib/student/quiz-bank";
import { startQuiz, submitQuizAttempt } from "@/lib/quiz/actions";
import type { StudentQuiz } from "@/lib/student/progress";
import type { QuizAttemptResult, StudentQuizQuestion } from "@/types/quiz";

// Sitting a weekend paper.
//
// Questions are loaded from the server WITHOUT the answer key; marking happens
// server-side on submit, which stores the attempt and returns the score plus a
// per-question review (the answers, revealed now). One question at a time, timed,
// and back-navigable — nothing is marked until the whole paper is handed in.

export function QuizRunner({
  quiz,
  onExit,
}: {
  quiz: StudentQuiz;
  onExit: () => void;
}) {
  const [questions, setQuestions] = React.useState<
    StudentQuizQuestion[] | null
  >(null);
  const [loadError, setLoadError] = React.useState<string | null>(
    quiz.quizId ? null : "This paper isn't available.",
  );
  const [answers, setAnswers] = React.useState<(number | null)[]>([]);
  const [index, setIndex] = React.useState(0);
  const [result, setResult] = React.useState<QuizAttemptResult | null>(null);
  const [ranOut, setRanOut] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  // Load the paper's questions once.
  React.useEffect(() => {
    let live = true;
    if (!quiz.quizId) return;
    startQuiz(quiz.quizId)
      .then((qs) => {
        if (!live) return;
        setQuestions(qs);
        setAnswers(qs.map(() => null));
      })
      .catch((e) =>
        live
          ? setLoadError(e instanceof Error ? e.message : "Failed to load")
          : null,
      );
    return () => {
      live = false;
    };
  }, [quiz.quizId]);

  const answered = answers.filter((a) => a !== null).length;

  const submit = React.useCallback(() => {
    if (!quiz.quizId || submitting || result) return;
    setSubmitting(true);
    submitQuizAttempt(quiz.quizId, answers)
      .then(setResult)
      .catch((e) =>
        setLoadError(e instanceof Error ? e.message : "Failed to submit"),
      )
      .finally(() => setSubmitting(false));
  }, [quiz.quizId, submitting, result, answers]);

  const handExpiry = React.useCallback(() => {
    setRanOut(true);
    submit();
  }, [submit]);

  function choose(optionIndex: number) {
    setAnswers((prev) => prev.map((a, i) => (i === index ? optionIndex : a)));
  }

  function retake() {
    setAnswers((questions ?? []).map(() => null));
    setIndex(0);
    setResult(null);
    setRanOut(false);
  }

  if (loadError) {
    return (
      <div className="py-16 text-center">
        <p className="text-sm text-destructive">{loadError}</p>
        <Button variant="tertiary" className="mt-4" onClick={onExit}>
          <ArrowLeft />
          Back to papers
        </Button>
      </div>
    );
  }

  if (!questions) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-sm text-mute">
        <Loader2 className="size-4 animate-spin" />
        Loading paper…
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="text-sm text-body">This paper has no questions yet.</p>
        <Button variant="tertiary" className="mt-4" onClick={onExit}>
          <ArrowLeft />
          Back to papers
        </Button>
      </div>
    );
  }

  if (result) {
    return (
      <QuizResult
        quiz={quiz}
        result={result}
        ranOut={ranOut}
        onRetake={retake}
        onExit={onExit}
      />
    );
  }

  const question = questions[index];
  const isLast = index === questions.length - 1;

  return (
    <div>
      {/* Paper header */}
      <header className="flex flex-col gap-5 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <Badge variant={quiz.kind === "assessment" ? "brand" : "neutral"}>
              {quiz.kind === "assessment" ? "Graded assessment" : "Practice"}
            </Badge>
            <span className="text-xs text-mute">Week {quiz.weekNumber}</span>
          </div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink">
            {quiz.title}
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <Countdown seconds={quizDurationSec(quiz)} onExpire={handExpiry} />
          <Button variant="tertiary" onClick={onExit}>
            <ArrowLeft />
            Leave
          </Button>
        </div>
      </header>

      {/* Progress */}
      <div className="mt-6 flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-3 text-sm">
          <span className="text-body">
            Question {index + 1} of {questions.length}
          </span>
          <span className="tabular-nums text-mute">{answered} answered</span>
        </div>
        <Meter
          percent={(answered / questions.length) * 100}
          label="Questions answered"
        />
      </div>

      {/* The question */}
      <div className="mt-6 rounded-xl border border-border bg-card p-6">
        <h2 className="font-display text-xl font-extrabold text-ink">
          {question.prompt}
        </h2>

        <div
          role="radiogroup"
          aria-label={question.prompt}
          className="mt-5 flex flex-col gap-3"
        >
          {question.options.map((option, i) => {
            const selected = answers[index] === i;
            return (
              <button
                key={i}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => choose(i)}
                className={cn(
                  "flex items-center gap-3 rounded-xl border px-5 py-4 text-left text-sm transition-colors",
                  selected
                    ? "border-ink bg-primary-pale/60 font-semibold text-ink"
                    : "border-border bg-card text-body hover:bg-secondary/40",
                )}
              >
                <span
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                    selected
                      ? "border-ink bg-primary text-primary-foreground"
                      : "border-border text-mute",
                  )}
                >
                  {selected ? <Check className="size-3.5" /> : LETTERS[i]}
                </span>
                {option}
              </button>
            );
          })}
        </div>
      </div>

      {/* Navigation */}
      <div className="mt-6 flex items-center justify-between gap-3">
        <Button
          variant="tertiary"
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
          disabled={index === 0}
        >
          <ArrowLeft />
          Back
        </Button>

        {isLast ? (
          <Button
            onClick={submit}
            disabled={answered < questions.length || submitting}
          >
            {submitting ? <Loader2 className="animate-spin" /> : <Send />}
            {answered < questions.length
              ? `${questions.length - answered} left`
              : "Submit paper"}
          </Button>
        ) : (
          <Button
            onClick={() =>
              setIndex((i) => Math.min(questions.length - 1, i + 1))
            }
            disabled={answers[index] === null}
          >
            Next
            <ArrowRight />
          </Button>
        )}
      </div>
    </div>
  );
}

const LETTERS = ["A", "B", "C", "D", "E"];
const URGENT_SECONDS = 30;

/** Exam-hall countdown. Anchored to a deadline once on mount; fires once at zero. */
function Countdown({
  seconds,
  onExpire,
}: {
  seconds: number;
  onExpire: () => void;
}) {
  const [remaining, setRemaining] = React.useState(seconds);
  const fired = React.useRef(false);

  React.useEffect(() => {
    const deadline = Date.now() + seconds * 1000;
    const id = setInterval(() => {
      const left = Math.max(0, Math.round((deadline - Date.now()) / 1000));
      setRemaining(left);
      if (left <= 0 && !fired.current) {
        fired.current = true;
        clearInterval(id);
        onExpire();
      }
    }, 250);
    return () => clearInterval(id);
  }, [seconds, onExpire]);

  const urgent = remaining <= URGENT_SECONDS;
  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;

  return (
    <span
      role="timer"
      aria-live={urgent ? "assertive" : "off"}
      aria-label={`${mins} minutes ${secs} seconds remaining`}
      className={cn(
        "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold tabular-nums",
        urgent ? "bg-destructive/10 text-destructive" : "bg-secondary text-ink",
      )}
    >
      {urgent ? (
        <AlarmClock className="size-4 animate-pulse" />
      ) : (
        <Timer className="size-4" />
      )}
      {mins}:{String(secs).padStart(2, "0")}
    </span>
  );
}

/** The marked paper: the score, then every question with the right answer. */
function QuizResult({
  quiz,
  result,
  ranOut,
  onRetake,
  onExit,
}: {
  quiz: StudentQuiz;
  result: QuizAttemptResult;
  ranOut: boolean;
  onRetake: () => void;
  onExit: () => void;
}) {
  const passed = result.score >= PASS_MARK;

  return (
    <div>
      <header className="flex flex-col gap-5 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1.5">
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink">
            {quiz.title}
          </h1>
          <p className="text-sm text-body">Marked · {result.total} questions</p>
        </div>
        <Button variant="tertiary" onClick={onExit}>
          <ArrowLeft />
          Back to papers
        </Button>
      </header>

      {ranOut && (
        <div className="mt-6 flex items-center gap-2 rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning-deep">
          <AlarmClock className="size-4 shrink-0" />
          Time ran out — the paper was handed in with the answers you had.
        </div>
      )}

      {/* Score */}
      <div
        className={cn(
          "mt-6 flex flex-col gap-4 rounded-xl border p-6 sm:flex-row sm:items-center sm:justify-between",
          passed
            ? "border-border bg-primary-pale/50"
            : "border-warning/40 bg-warning/10",
        )}
      >
        <div>
          <div className="font-display text-5xl font-extrabold tabular-nums text-ink">
            {result.score}%
          </div>
          <p className="mt-1 text-sm text-body">
            {result.correctCount} of {result.total} correct ·{" "}
            {passed
              ? "you passed this paper"
              : `the pass mark is ${PASS_MARK}% — have another go`}
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          {quiz.kind === "practice" && (
            <Button variant="secondary" onClick={onRetake}>
              <RotateCcw />
              Try again
            </Button>
          )}
          <Button onClick={onExit}>Done</Button>
        </div>
      </div>

      {/* The teaching part */}
      <section aria-labelledby="answers-heading" className="mt-6">
        <h2
          id="answers-heading"
          className="font-display text-xl font-extrabold text-ink"
        >
          Your answers
        </h2>

        <ol className="mt-4 flex flex-col gap-3">
          {result.review.map((r) => {
            const right =
              r.chosenIndex !== null && r.chosenIndex === r.correctIndex;
            return (
              <li
                key={r.questionId}
                className="rounded-xl border border-border bg-card p-5"
              >
                <div className="flex items-start gap-3">
                  <span
                    className={cn(
                      "flex size-7 shrink-0 items-center justify-center rounded-full",
                      right
                        ? "bg-primary-pale text-positive-deep"
                        : "bg-destructive/10 text-destructive",
                    )}
                  >
                    {right ? (
                      <CheckCircle2 className="size-4" />
                    ) : (
                      <X className="size-4" />
                    )}
                  </span>

                  <div className="min-w-0">
                    <div className="font-semibold text-ink">{r.prompt}</div>

                    {!right && r.chosenIndex !== null && (
                      <p className="mt-1 text-sm text-destructive">
                        You chose: {r.options[r.chosenIndex]}
                      </p>
                    )}
                    <p className="mt-1 text-sm text-body">
                      <span className="font-semibold text-ink">Answer:</span>{" "}
                      {r.options[r.correctIndex]}
                    </p>
                    {r.explanation ? (
                      <p className="mt-1 text-sm text-mute">{r.explanation}</p>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}
