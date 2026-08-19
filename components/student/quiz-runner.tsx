"use client";

import * as React from "react";
import {
  AlarmClock,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Loader2,
  Send,
  Timer,
  X,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Meter } from "@/components/student/progress-tracker";
import { PASS_MARK, quizDurationSec } from "@/lib/student/quiz-bank";
import { getQuizReview, startQuiz, submitQuizAttempt } from "@/lib/quiz/actions";
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
  const [answers, setAnswers] = React.useState<number[][]>([]);
  const [index, setIndex] = React.useState(0);
  const [result, setResult] = React.useState<QuizAttemptResult | null>(null);
  const [ranOut, setRanOut] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  // Load the paper's questions or past attempt review once.
  React.useEffect(() => {
    let live = true;
    if (!quiz.quizId) return;

    if (quiz.state === "done") {
      getQuizReview(quiz.quizId)
        .then((res) => {
          if (!live) return;
          if (res) {
            setResult(res);
          } else {
            startQuiz(quiz.quizId!).then((qs) => {
              if (!live) return;
              setQuestions(qs);
              setAnswers(qs.map(() => []));
            });
          }
        })
        .catch((e) =>
          live
            ? setLoadError(e instanceof Error ? e.message : "Failed to load review")
            : null,
        );
      return () => {
        live = false;
      };
    }

    startQuiz(quiz.quizId)
      .then((qs) => {
        if (!live) return;
        setQuestions(qs);
        setAnswers(qs.map(() => []));
      })
      .catch((e) =>
        live
          ? setLoadError(e instanceof Error ? e.message : "Failed to load")
          : null,
      );
    return () => {
      live = false;
    };
  }, [quiz.quizId, quiz.state]);

  const answered = answers.filter((a) => a.length > 0).length;

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
    setAnswers((prev) =>
      prev.map((answer, i) => {
        if (i !== index) return answer;
        if (questions?.[index]?.answerMode !== "multiple") return [optionIndex];
        return answer.includes(optionIndex)
          ? answer.filter((selected) => selected !== optionIndex)
          : [...answer, optionIndex].sort((a, b) => a - b);
      }),
    );
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

  if (result) {
    return (
      <QuizResult
        quiz={quiz}
        result={result}
        ranOut={ranOut}
        onExit={onExit}
      />
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
            <Badge variant="brand">Graded paper</Badge>
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
        <h2 className="whitespace-pre-wrap font-display text-xl font-extrabold text-ink leading-relaxed">
          {question.prompt}
        </h2>
        <p className="mt-2 text-xs font-medium text-mute">
          {question.answerMode === "multiple"
            ? "Select all answers that apply."
            : question.answerMode === "true_false"
              ? "Choose True or False."
              : "Select one answer."}
        </p>

        <div
          role={question.answerMode === "multiple" ? "group" : "radiogroup"}
          aria-label={question.prompt}
          className="mt-5 flex flex-col gap-3"
        >
          {question.options.map((option, i) => {
            const selected = answers[index].includes(i);
            return (
              <button
                key={i}
                type="button"
                role={question.answerMode === "multiple" ? "checkbox" : "radio"}
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
                    "flex size-6 shrink-0 items-center justify-center border text-xs font-semibold",
                    question.answerMode === "multiple" ? "rounded-md" : "rounded-full",
                    selected
                      ? "border-ink bg-primary text-primary-foreground"
                      : "border-border text-mute",
                  )}
                >
                  {selected ? <Check className="size-3.5" /> : LETTERS[i]}
                </span>
                <span className="whitespace-pre-wrap flex-1">{option}</span>
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
            disabled={answers[index].length === 0}
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
  const onExpireRef = React.useRef(onExpire);

  React.useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);

  React.useEffect(() => {
    const deadline = Date.now() + seconds * 1000;
    const id = setInterval(() => {
      const left = Math.max(0, Math.round((deadline - Date.now()) / 1000));
      setRemaining(left);
      if (left <= 0 && !fired.current) {
        fired.current = true;
        clearInterval(id);
        onExpireRef.current();
      }
    }, 250);
    return () => clearInterval(id);
  }, [seconds]);

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
  onExit,
}: {
  quiz: StudentQuiz;
  result: QuizAttemptResult;
  ranOut: boolean;
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
              : `below the ${PASS_MARK}% pass mark`}{" "}
            · this score is now on the leaderboard
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
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

        <ol className="mt-4 flex flex-col gap-4">
          {result.review.map((r, qIndex) => {
            const right =
              r.chosenIndices.length === r.correctIndices.length &&
              r.correctIndices.every((index) => r.chosenIndices.includes(index));
            return (
              <li
                key={r.questionId}
                className="rounded-xl border border-border bg-card p-5 shadow-xs"
              >
                <div className="flex items-start gap-3">
                  <span
                    className={cn(
                      "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold mt-0.5",
                      right
                        ? "bg-emerald-500/15 text-emerald-600"
                        : "bg-rose-500/15 text-rose-600",
                    )}
                  >
                    {right ? (
                      <CheckCircle2 className="size-4" />
                    ) : (
                      <XCircle className="size-4" />
                    )}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="text-xs font-bold text-mute uppercase tracking-wider">
                        Question {qIndex + 1}
                      </span>
                      <Badge variant={right ? "positive" : "negative"}>
                        {right ? "Correct" : "Incorrect"}
                      </Badge>
                    </div>

                    <div className="whitespace-pre-wrap font-semibold text-ink text-base leading-relaxed">
                      {r.prompt}
                    </div>

                    {/* All 4 options with color coding for correct / incorrect / selected */}
                    <div className="mt-4 flex flex-col gap-2">
                      {r.options.map((option, oi) => {
                        const isChosen = r.chosenIndices.includes(oi);
                        const isCorrect = r.correctIndices.includes(oi);

                        let statusStyle = "border-border/60 bg-muted/20 text-body/80 opacity-75";
                        let badgeText: string | null = null;
                        let badgeColor = "";

                        if (isCorrect && isChosen) {
                          statusStyle = "border-emerald-500/60 bg-emerald-500/10 text-emerald-950 font-semibold";
                          badgeText = "Your choice (Correct)";
                          badgeColor = "bg-emerald-600 text-white";
                        } else if (isCorrect) {
                          statusStyle = "border-emerald-500/60 bg-emerald-500/10 text-emerald-950 font-semibold";
                          badgeText = "Correct answer";
                          badgeColor = "bg-emerald-600 text-white";
                        } else if (isChosen) {
                          statusStyle = "border-rose-500/60 bg-rose-500/10 text-rose-950 font-semibold";
                          badgeText = "Your choice (Incorrect)";
                          badgeColor = "bg-rose-500 text-white";
                        }

                        return (
                          <div
                            key={oi}
                            className={cn(
                              "flex flex-wrap items-center justify-between gap-2 rounded-lg border px-4 py-3 text-sm transition-colors",
                              statusStyle,
                            )}
                          >
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <span
                                className={cn(
                                  "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold border",
                                  isCorrect
                                    ? "border-emerald-600 bg-emerald-600 text-white"
                                    : isChosen
                                      ? "border-rose-500 bg-rose-500 text-white"
                                      : "border-border text-mute bg-background",
                                )}
                              >
                                {LETTERS[oi]}
                              </span>
                              <span className="whitespace-pre-wrap">{option}</span>
                            </div>

                            {badgeText ? (
                              <span
                                className={cn(
                                  "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold shrink-0",
                                  badgeColor,
                                )}
                              >
                                {isCorrect ? (
                                  <CheckCircle2 className="size-3" />
                                ) : (
                                  <XCircle className="size-3" />
                                )}
                                {badgeText}
                              </span>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>

                    {r.explanation ? (
                      <div className="mt-4 whitespace-pre-wrap rounded-lg bg-secondary/60 p-3.5 text-sm text-body border border-border/60">
                        <span className="font-semibold text-ink block mb-1">Explanation:</span>
                        {r.explanation}
                      </div>
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
