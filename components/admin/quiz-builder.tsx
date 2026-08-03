"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  BadgeCheck,
  Check,
  Globe,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveQuiz, setQuizPublished } from "@/lib/quiz/actions";
import type { AdminQuiz, QuizQuestion } from "@/types/quiz";

// Admin > Content > weekend quiz builder. Author the paper's title and its
// multiple-choice questions (2–5 options each, one correct), then publish it.
// Saved as one batched write; publish is a separate toggle.

const LETTERS = ["A", "B", "C", "D", "E"];
const MIN_OPTIONS = 2;
const MAX_OPTIONS = 5;

function blankQuestion(): QuizQuestion {
  return { prompt: "", options: ["", ""], correctIndex: 0, explanation: "" };
}

export function QuizBuilder({ quiz }: { quiz: AdminQuiz }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [title, setTitle] = React.useState(quiz.title);
  const [questions, setQuestions] = React.useState<QuizQuestion[]>(
    quiz.questions.length ? quiz.questions : [blankQuestion()],
  );
  const [error, setError] = React.useState<string | null>(null);

  const published = quiz.status === "published";

  function patch(i: number, next: Partial<QuizQuestion>) {
    setQuestions((prev) =>
      prev.map((q, idx) => (idx === i ? { ...q, ...next } : q)),
    );
  }

  function setOption(qi: number, oi: number, value: string) {
    setQuestions((prev) =>
      prev.map((q, idx) =>
        idx === qi
          ? { ...q, options: q.options.map((o, k) => (k === oi ? value : o)) }
          : q,
      ),
    );
  }

  function addOption(qi: number) {
    setQuestions((prev) =>
      prev.map((q, idx) =>
        idx === qi && q.options.length < MAX_OPTIONS
          ? { ...q, options: [...q.options, ""] }
          : q,
      ),
    );
  }

  function removeOption(qi: number, oi: number) {
    setQuestions((prev) =>
      prev.map((q, idx) => {
        if (idx !== qi || q.options.length <= MIN_OPTIONS) return q;
        const options = q.options.filter((_, k) => k !== oi);
        const correctIndex =
          q.correctIndex === oi
            ? 0
            : q.correctIndex > oi
              ? q.correctIndex - 1
              : q.correctIndex;
        return { ...q, options, correctIndex };
      }),
    );
  }

  /** Reject empty prompts / blank correct options before saving. */
  function validate(): string | null {
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.prompt.trim()) return `Question ${i + 1} needs a prompt.`;
      const filled = q.options.filter((o) => o.trim().length > 0);
      if (filled.length < MIN_OPTIONS)
        return `Question ${i + 1} needs at least ${MIN_OPTIONS} options.`;
      if (!q.options[q.correctIndex]?.trim())
        return `Question ${i + 1}: the correct option is empty.`;
    }
    return null;
  }

  function runSave(alsoPublish: boolean) {
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    startTransition(async () => {
      await saveQuiz({
        courseSlug: quiz.courseSlug,
        weekNumber: quiz.weekNumber,
        day: quiz.day,
        title: title.trim() || `Week ${quiz.weekNumber} ${quiz.kind}`,
        questions,
      });
      if (alsoPublish) {
        await setQuizPublished({
          courseSlug: quiz.courseSlug,
          weekNumber: quiz.weekNumber,
          day: quiz.day,
          publish: !published,
        });
      }
      router.refresh();
    });
  }

  return (
    <div>
      <Link
        href={`/admin/content-management/${quiz.courseSlug}`}
        className="inline-flex items-center gap-2 text-sm font-semibold text-body transition-colors hover:text-ink"
      >
        <ArrowLeft className="size-4" />
        {quiz.courseTitle}
      </Link>

      {/* Header */}
      <header className="mt-4 flex flex-col gap-5 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <Badge variant="brand">Graded paper</Badge>
            <span className="text-xs capitalize text-mute">
              Week {quiz.weekNumber} · {quiz.day}
            </span>
            {published ? <Badge variant="positive">Published</Badge> : null}
          </div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink">
            Weekend quiz
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant={published ? "secondary" : "tertiary"}
            disabled={pending}
            onClick={() => runSave(true)}
          >
            {published ? <BadgeCheck /> : <Globe />}
            {published ? "Unpublish" : "Publish"}
          </Button>
          <Button disabled={pending} onClick={() => runSave(false)}>
            {pending ? <Loader2 className="animate-spin" /> : <Check />}
            Save
          </Button>
        </div>
      </header>

      {/* Title */}
      <div className="mt-6 grid max-w-lg gap-2">
        <Label htmlFor="quiz-title">Title</Label>
        <Input
          id="quiz-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={`Week ${quiz.weekNumber} ${quiz.kind}`}
        />
      </div>

      {error ? (
        <p className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {/* Questions */}
      <div className="mt-6 flex flex-col gap-4">
        {questions.map((q, qi) => (
          <article
            key={qi}
            className="rounded-xl border border-border bg-card p-5"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-semibold text-ink">
                Question {qi + 1}
              </span>
              <Button
                variant="ghost"
                size="sm"
                disabled={questions.length <= 1}
                className="text-destructive [&_svg]:text-destructive"
                onClick={() =>
                  setQuestions((prev) => prev.filter((_, idx) => idx !== qi))
                }
              >
                <Trash2 />
                Remove
              </Button>
            </div>

            <div className="mt-3 grid gap-2">
              <Label htmlFor={`prompt-${qi}`}>Prompt</Label>
              <Input
                id={`prompt-${qi}`}
                value={q.prompt}
                onChange={(e) => patch(qi, { prompt: e.target.value })}
                placeholder="She ____ to the market every Sunday."
              />
            </div>

            {/* Options — click the letter to mark the correct one. */}
            <div className="mt-4 flex flex-col gap-2">
              <span className="text-xs font-medium text-mute">
                Options — tap the letter to mark the correct answer
              </span>
              {q.options.map((option, oi) => {
                const correct = q.correctIndex === oi;
                return (
                  <div key={oi} className="flex items-center gap-2">
                    <button
                      type="button"
                      aria-label={`Mark option ${LETTERS[oi]} correct`}
                      aria-pressed={correct}
                      onClick={() => patch(qi, { correctIndex: oi })}
                      className={cn(
                        "grid size-8 shrink-0 place-items-center rounded-full border text-xs font-bold transition-colors",
                        correct
                          ? "border-ink bg-primary text-primary-foreground"
                          : "border-border text-mute hover:border-ink",
                      )}
                    >
                      {correct ? <Check className="size-4" /> : LETTERS[oi]}
                    </button>
                    <Input
                      value={option}
                      onChange={(e) => setOption(qi, oi, e.target.value)}
                      placeholder={`Option ${LETTERS[oi]}`}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove option ${LETTERS[oi]}`}
                      disabled={q.options.length <= MIN_OPTIONS}
                      onClick={() => removeOption(qi, oi)}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                );
              })}
              {q.options.length < MAX_OPTIONS ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="self-start"
                  onClick={() => addOption(qi)}
                >
                  <Plus />
                  Add option
                </Button>
              ) : null}
            </div>

            <div className="mt-4 grid gap-2">
              <Label htmlFor={`explain-${qi}`}>
                Explanation{" "}
                <span className="font-normal text-mute">
                  (shown after marking)
                </span>
              </Label>
              <Input
                id={`explain-${qi}`}
                value={q.explanation}
                onChange={(e) => patch(qi, { explanation: e.target.value })}
                placeholder="Why the correct answer is correct."
              />
            </div>
          </article>
        ))}

        <Button
          variant="tertiary"
          className="self-start"
          onClick={() => setQuestions((prev) => [...prev, blankQuestion()])}
        >
          <Plus />
          Add question
        </Button>
      </div>
    </div>
  );
}
