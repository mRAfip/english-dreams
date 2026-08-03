"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, ChevronDown, Loader2, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  addFollowup,
  addQuestion,
  deleteFollowup,
  deleteQuestion,
  moveQuestion,
  updateFollowup,
  updateQuestion,
} from "@/lib/tasks/actions";
import {
  QUESTION_TYPES,
  QUESTION_TYPE_LABEL,
  type TaskFollowup,
  type TaskQuestion,
  type TaskQuestionType,
} from "@/types/task";

// Admin > Content > Day — authoring the day's task as typed questions. Text /
// editing / fill-in-the-blanks take a single prompt; reading comprehension adds
// a passage and follow-up questions.

const TYPE_HINT: Record<TaskQuestionType, string> = {
  text: "Student writes a text answer (e.g. a translation)",
  editing: "Student fixes the mistakes in a given sentence",
  fill_blanks: "Student fills in the blanks",
  comprehension: "A passage with follow-up questions to answer",
};

export function TaskBuilder({
  courseSlug,
  dayNumber,
  questions,
}: {
  courseSlug: string;
  dayNumber: number;
  questions: TaskQuestion[];
}) {
  const router = useRouter();
  const [adding, setAdding] = React.useState(false);

  async function add(type: TaskQuestionType) {
    setAdding(true);
    try {
      await addQuestion({ courseSlug, dayNumber, type });
      toast.success(`Added: ${QUESTION_TYPE_LABEL[type]}`);
      router.refresh();
    } catch (e) {
      toast.error("Couldn't add", {
        description: e instanceof Error ? e.message : "Something went wrong",
      });
    } finally {
      setAdding(false);
    }
  }

  return (
    <article className="rounded-xl border border-border">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="text-sm font-semibold text-ink">
          Task · {questions.length}{" "}
          {questions.length === 1 ? "question" : "questions"}
        </div>
        {/* Pick the type from the menu — no hidden "last selected" state. */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="secondary" size="sm" disabled={adding}>
              {adding ? <Loader2 className="animate-spin" /> : <Plus />}
              Add question
              <ChevronDown className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72">
            {QUESTION_TYPES.map((t) => (
              <DropdownMenuItem
                key={t}
                onSelect={() => add(t)}
                className="flex-col items-start gap-0.5"
              >
                <span className="text-sm font-semibold text-ink">
                  {QUESTION_TYPE_LABEL[t]}
                </span>
                <span className="text-xs text-mute">{TYPE_HINT[t]}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex flex-col gap-3 p-4">
        {questions.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-mute">
            No questions yet. Pick a type and add the first one.
          </div>
        ) : (
          questions.map((q, i) => (
            <QuestionCard
              key={q.id}
              courseSlug={courseSlug}
              dayNumber={dayNumber}
              question={q}
              index={i}
              total={questions.length}
            />
          ))
        )}
      </div>
    </article>
  );
}

function QuestionCard({
  courseSlug,
  dayNumber,
  question,
  index,
  total,
}: {
  courseSlug: string;
  dayNumber: number;
  question: TaskQuestion;
  index: number;
  total: number;
}) {
  const router = useRouter();
  const [prompt, setPrompt] = React.useState(question.prompt);
  const [passage, setPassage] = React.useState(question.passage ?? "");
  const [busy, setBusy] = React.useState(false);
  const isComprehension = question.type === "comprehension";
  const dirty =
    prompt !== question.prompt || passage !== (question.passage ?? "");

  async function run(label: string, action: () => Promise<void>) {
    setBusy(true);
    try {
      await action();
      router.refresh();
    } catch (e) {
      toast.error(label, {
        description: e instanceof Error ? e.message : "Something went wrong",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-border p-3">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-ink">Q{index + 1}</span>
          <Badge variant="neutral">{QUESTION_TYPE_LABEL[question.type]}</Badge>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            disabled={busy || index === 0}
            aria-label="Move up"
            onClick={() =>
              run("Couldn't reorder", () =>
                moveQuestion({ courseSlug, dayNumber, id: question.id, direction: "up" }),
              )
            }
          >
            <ArrowUp />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={busy || index === total - 1}
            aria-label="Move down"
            onClick={() =>
              run("Couldn't reorder", () =>
                moveQuestion({ courseSlug, dayNumber, id: question.id, direction: "down" }),
              )
            }
          >
            <ArrowDown />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={busy}
            className="text-destructive hover:text-destructive"
            aria-label="Delete question"
            onClick={() =>
              run("Couldn't delete", async () => {
                await deleteQuestion({ courseSlug, dayNumber, id: question.id });
                toast.success("Question removed");
              })
            }
          >
            {busy ? <Loader2 className="animate-spin" /> : <Trash2 />}
          </Button>
        </div>
      </div>

      <div className="grid gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor={`prompt-${question.id}`} className="text-xs text-mute">
            {isComprehension ? "Instruction" : "Question / instruction"}
          </Label>
          <Textarea
            id={`prompt-${question.id}`}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={2}
            placeholder={promptPlaceholder(question.type)}
            disabled={busy}
          />
        </div>

        {isComprehension ? (
          <div className="grid gap-1.5">
            <Label htmlFor={`passage-${question.id}`} className="text-xs text-mute">
              Passage
            </Label>
            <Textarea
              id={`passage-${question.id}`}
              value={passage}
              onChange={(e) => setPassage(e.target.value)}
              rows={5}
              placeholder="Paste the reading passage students will answer questions about…"
              disabled={busy}
            />
          </div>
        ) : null}

        <div className="flex justify-end">
          <Button
            variant="secondary"
            size="sm"
            disabled={busy || !dirty}
            onClick={() =>
              run("Couldn't save", async () => {
                await updateQuestion({
                  courseSlug,
                  dayNumber,
                  id: question.id,
                  prompt,
                  passage: isComprehension ? passage.trim() || null : null,
                });
                toast.success("Saved");
              })
            }
          >
            Save
          </Button>
        </div>

        {isComprehension ? (
          <FollowupsEditor
            courseSlug={courseSlug}
            dayNumber={dayNumber}
            question={question}
          />
        ) : null}
      </div>
    </div>
  );
}

function FollowupsEditor({
  courseSlug,
  dayNumber,
  question,
}: {
  courseSlug: string;
  dayNumber: number;
  question: TaskQuestion;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);

  async function add() {
    setBusy(true);
    try {
      await addFollowup({ courseSlug, dayNumber, questionId: question.id });
      router.refresh();
    } catch {
      toast.error("Couldn't add follow-up");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg bg-muted/40 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold text-ink">
          Follow-up questions ({question.followups.length})
        </span>
        <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={add}>
          <Plus />
          Add
        </Button>
      </div>
      <div className="flex flex-col gap-2">
        {question.followups.length === 0 ? (
          <p className="text-xs text-mute">
            Add the questions students answer about the passage.
          </p>
        ) : (
          question.followups.map((f, i) => (
            <FollowupRow
              key={f.id}
              courseSlug={courseSlug}
              dayNumber={dayNumber}
              followup={f}
              index={i}
            />
          ))
        )}
      </div>
    </div>
  );
}

function FollowupRow({
  courseSlug,
  dayNumber,
  followup,
  index,
}: {
  courseSlug: string;
  dayNumber: number;
  followup: TaskFollowup;
  index: number;
}) {
  const router = useRouter();
  const [prompt, setPrompt] = React.useState(followup.prompt);
  const [busy, setBusy] = React.useState(false);
  const dirty = prompt !== followup.prompt;

  async function run(action: () => Promise<void>) {
    setBusy(true);
    try {
      await action();
      router.refresh();
    } catch {
      toast.error("Couldn't save follow-up");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-semibold text-mute">{index + 1}.</span>
      <Input
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Follow-up question…"
        disabled={busy}
        className="h-9"
      />
      <Button
        variant="secondary"
        size="sm"
        disabled={busy || !dirty}
        onClick={() =>
          run(() => updateFollowup({ courseSlug, dayNumber, id: followup.id, prompt }))
        }
      >
        Save
      </Button>
      <Button
        variant="ghost"
        size="sm"
        disabled={busy}
        className="text-destructive hover:text-destructive"
        aria-label="Delete follow-up"
        onClick={() => run(() => deleteFollowup({ courseSlug, dayNumber, id: followup.id }))}
      >
        <Trash2 />
      </Button>
    </div>
  );
}

function promptPlaceholder(type: TaskQuestionType): string {
  switch (type) {
    case "text":
      return "e.g. Translate to Malayalam: “Where is the nearest station?”";
    case "editing":
      return "e.g. Find and fix the mistakes: “She go to school every days.”";
    case "fill_blanks":
      return "e.g. Fill the blanks: “I ___ (go) to the market yesterday.”";
    case "comprehension":
      return "e.g. Read the passage and answer the questions below.";
  }
}
