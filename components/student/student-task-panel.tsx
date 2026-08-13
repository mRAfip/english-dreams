"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Mic, Paperclip, Send, Square, X, MessageSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { ReviewThread } from "@/components/tasks/review-thread";
import {
  requestSubmissionAudioUploadUrl,
  submitTask,
} from "@/lib/tasks/actions";
import {
  QUESTION_TYPE_LABEL,
  STATUS_LABEL,
  type AnswerInput,
  type ReviewComment,
  type SubmissionStatus,
  type TaskQuestion,
  type TaskSubmission,
} from "@/types/task";
import type { Role } from "@/types/role";

// Student > day > Task tab. Renders each authored question by type with a text
// box + optional voice answer, submits to task_submissions, and — once
// submitted — shows the trainer's review status and the realtime comment thread.
// Editable while there's no submission or a redo was requested.

type ExistingAudio = { url: string; name: string; durationMin: number | null; key: string };
type AnswerState = { text: string; file: File | null; existing: ExistingAudio | null };

function slotKey(questionId: string, followupId: string | null): string {
  return `${questionId}::${followupId ?? ""}`;
}

const STATUS_VARIANT: Record<SubmissionStatus, "positive" | "warning" | "negative"> = {
  approved: "positive",
  submitted: "warning",
  redo: "negative",
};

export function StudentTaskPanel({
  dayNumber,
  questions,
  submission,
  meId,
  comments,
  threadAuthors,
}: {
  dayNumber: number;
  questions: TaskQuestion[];
  submission: TaskSubmission | null;
  meId: string;
  comments: ReviewComment[];
  threadAuthors: Record<string, { name: string; role: Role | null }>;
}) {
  const router = useRouter();
  const editable = !submission || submission.status === "redo";
  const [submitting, setSubmitting] = React.useState(false);
  const [openComments, setOpenComments] = React.useState<Record<string, boolean>>(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const q = params.get("q");
      if (q) {
        return { [q]: true };
      }
    }
    return {};
  });

  const [answers, setAnswers] = React.useState<Record<string, AnswerState>>(() => {
    const bySlot = new Map(
      (submission?.answers ?? []).map((a) => [slotKey(a.questionId, a.followupId), a]),
    );
    const map: Record<string, AnswerState> = {};
    for (const q of questions) {
      const slots =
        q.type === "comprehension"
          ? q.followups.map((f) => f.id as string | null)
          : [null];
      for (const fid of slots) {
        const a = bySlot.get(slotKey(q.id, fid));
        map[slotKey(q.id, fid)] = {
          text: a?.text ?? "",
          file: null,
          existing:
            a?.audio && a.audioKey
              ? {
                  url: a.audio.url,
                  name: a.audio.name,
                  durationMin: a.audio.durationMin,
                  key: a.audioKey,
                }
              : null,
        };
      }
    }
    return map;
  });

  function patch(k: string, next: Partial<AnswerState>) {
    setAnswers((prev) => ({ ...prev, [k]: { ...prev[k], ...next } }));
  }

  async function handleSubmit() {
    const missingAudio = questions.some((question) => {
      if (question.type !== "audio") return false;
      const answer = answers[slotKey(question.id, null)];
      return !answer?.file && !answer?.existing;
    });
    if (missingAudio) {
      toast.error("Record or attach audio for every audio question");
      return;
    }

    setSubmitting(true);
    try {
      const inputs: AnswerInput[] = [];
      for (const q of questions) {
        const slots =
          q.type === "comprehension"
            ? q.followups.map((f) => f.id as string | null)
            : [null];
        for (const fid of slots) {
          const a = answers[slotKey(q.id, fid)];
          let audio: AnswerInput["audio"] = null;
          if (a.file) {
            const { key, uploadUrl } = await requestSubmissionAudioUploadUrl({
              fileName: a.file.name,
            });
            const put = await fetch(uploadUrl, {
              method: "PUT",
              body: a.file,
              headers: a.file.type ? { "Content-Type": a.file.type } : undefined,
            });
            if (!put.ok) throw new Error(`Audio upload failed (${put.status})`);
            audio = {
              key,
              name: a.file.name,
              contentType: a.file.type || null,
              durationMin: null,
            };
          } else if (a.existing) {
            audio = {
              key: a.existing.key,
              name: a.existing.name,
              contentType: null,
              durationMin: a.existing.durationMin,
            };
          }
          inputs.push({ questionId: q.id, followupId: fid, text: a.text, audio });
        }
      }

      if (!inputs.some((i) => i.text.trim() || i.audio)) {
        toast.error("Answer at least one question first");
        setSubmitting(false);
        return;
      }

      const result = await submitTask(dayNumber, inputs);
      if (result.ok) {
        toast.success(submission ? "Resubmitted" : "Submitted to your trainer");
        router.refresh();
      } else {
        toast.error("Couldn't submit", { description: result.error });
      }
    } catch (e) {
      toast.error("Couldn't submit", {
        description: e instanceof Error ? e.message : "Something went wrong",
      });
    } finally {
      setSubmitting(false);
    }
  }

  if (questions.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-mute">
        No task set for this day.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {submission ? (
        <div className="flex items-center gap-2">
          <Badge variant={STATUS_VARIANT[submission.status]}>
            {STATUS_LABEL[submission.status]}
          </Badge>
          <span className="text-xs text-mute">
            Submitted {submission.submittedAt}
          </span>
        </div>
      ) : null}

      {questions.map((q) => (
        <div key={q.id} className="rounded-xl border border-border p-4">
          <div className="mb-2 flex items-center gap-2">
            <span className="text-sm font-semibold text-ink">
              {q.type === "comprehension" ? "Reading" : `Question`}
            </span>
            <Badge variant="outline">{QUESTION_TYPE_LABEL[q.type]}</Badge>
          </div>
          {q.prompt ? (
            <p className="whitespace-pre-wrap text-sm text-body">{q.prompt}</p>
          ) : null}

          {q.type === "comprehension" ? (
            <>
              {q.passage ? (
                <div className="mt-3 whitespace-pre-wrap rounded-lg bg-muted px-4 py-3 text-sm text-body">
                  {q.passage}
                </div>
              ) : null}
              <div className="mt-4 flex flex-col gap-4">
                {q.followups.map((f, idx) => (
                  <AnswerField
                    key={f.id}
                    label={`${idx + 1}. ${f.prompt}`}
                    editable={editable}
                    state={answers[slotKey(q.id, f.id)]}
                    onText={(text) => patch(slotKey(q.id, f.id), { text })}
                    onFile={(file) => patch(slotKey(q.id, f.id), { file })}
                    onClearAudio={() =>
                      patch(slotKey(q.id, f.id), { file: null, existing: null })
                    }
                  />
                ))}
              </div>
            </>
          ) : (
            <div className="mt-3">
              <AnswerField
                label={q.type === "audio" ? "Your audio answer" : "Your answer"}
                editable={editable}
                state={answers[slotKey(q.id, null)]}
                audioOnly={q.type === "audio"}
                onText={(text) => patch(slotKey(q.id, null), { text })}
                onFile={(file) => patch(slotKey(q.id, null), { file })}
                onClearAudio={() =>
                  patch(slotKey(q.id, null), { file: null, existing: null })
                }
              />
            </div>
          )}

          {/* Collapsible question-specific review comments (only when a submission exists) */}
          {submission && (
            <div className="mt-4 border-t border-border pt-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  setOpenComments((prev) => ({ ...prev, [q.id]: !prev[q.id] }))
                }
                className="flex items-center gap-2 text-xs font-semibold text-body hover:text-ink hover:bg-secondary/40"
              >
                <MessageSquare className="size-4" />
                {openComments[q.id] ? "Hide comments" : "Comment on question"}
                {comments.filter((c) => c.questionId === q.id).length > 0 && (
                  <Badge variant="neutral" className="ml-1.5 px-1.5 py-0.5 text-[10px]">
                    {comments.filter((c) => c.questionId === q.id).length}
                  </Badge>
                )}
              </Button>

              {openComments[q.id] && (
                <div className="mt-3">
                  <ReviewThread
                    submissionId={submission.id}
                    meId={meId}
                    initialComments={comments.filter((c) => c.questionId === q.id)}
                    authors={threadAuthors}
                    placeholder="Discuss this question…"
                    questionId={q.id}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      ))}

      {editable ? (
        <div className="flex items-center justify-end gap-3">
          {submission?.status === "redo" ? (
            <span className="text-xs text-body">
              Your trainer asked for changes — update your answers and resubmit.
            </span>
          ) : null}
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? <Loader2 className="animate-spin" /> : <Send />}
            {submission ? "Resubmit" : "Submit"}
          </Button>
        </div>
      ) : null}

      {submission ? (
        <div id="discussion">
          <h3 className="mb-2 text-sm font-semibold text-ink">Trainer review</h3>
          <ReviewThread
            submissionId={submission.id}
            meId={meId}
            initialComments={comments.filter((c) => !c.questionId)}
            authors={threadAuthors}
            placeholder="Reply to your trainer…"
          />
        </div>
      ) : null}
    </div>
  );
}

function AnswerField({
  label,
  editable,
  state,
  onText,
  onFile,
  onClearAudio,
  audioOnly = false,
}: {
  label: string;
  editable: boolean;
  state: AnswerState;
  onText: (text: string) => void;
  onFile: (file: File) => void;
  onClearAudio: () => void;
  audioOnly?: boolean;
}) {
  const previewUrl = React.useMemo(
    () => (state.file ? URL.createObjectURL(state.file) : state.existing?.url ?? null),
    [state.file, state.existing],
  );
  React.useEffect(() => {
    return () => {
      if (state.file && previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [state.file, previewUrl]);

  if (!editable) {
    return (
      <div className="flex flex-col gap-2">
        <div className="text-xs font-medium text-ink">{label}</div>
        {state.text ? (
          <p className="whitespace-pre-wrap rounded-lg border border-border px-4 py-3 text-sm text-body">
            {state.text}
          </p>
        ) : null}
        {state.existing ? (
          <audio controls src={state.existing.url} className="h-9 w-full max-w-sm" />
        ) : null}
        {!state.text && !state.existing ? (
          <p className="text-sm text-mute">No answer.</p>
        ) : null}
      </div>
    );
  }

  const hasAudio = Boolean(state.file || state.existing);

  return (
    <div className="flex flex-col gap-2">
      <div className="text-xs font-medium text-ink">{label}</div>
      {!audioOnly ? (
        <Textarea
          value={state.text}
          onChange={(e) => onText(e.target.value)}
          rows={3}
          placeholder="Type your answer…"
        />
      ) : null}
      {hasAudio && previewUrl ? (
        <div className="flex items-center gap-2">
          <audio controls src={previewUrl} className="h-9 min-w-0 flex-1" />
          <button
            type="button"
            onClick={onClearAudio}
            aria-label="Remove audio"
            className="shrink-0 rounded-md p-1.5 text-mute transition-colors hover:text-ink"
          >
            <X className="size-4" />
          </button>
        </div>
      ) : (
        <AudioControls onFile={onFile} />
      )}
    </div>
  );
}

/** Record a voice answer or attach an audio file. */
function AudioControls({ onFile }: { onFile: (file: File) => void }) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const recorderRef = React.useRef<MediaRecorder | null>(null);
  const chunksRef = React.useRef<Blob[]>([]);
  const timerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const [recording, setRecording] = React.useState(false);
  const [elapsed, setElapsed] = React.useState(0);

  const canRecord =
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices &&
    typeof window !== "undefined" &&
    "MediaRecorder" in window;

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const type = recorder.mimeType || "audio/webm";
        const ext = type.includes("mp4") ? "m4a" : type.includes("ogg") ? "ogg" : "webm";
        onFile(new File(chunksRef.current, `voice-answer.${ext}`, { type }));
        stream.getTracks().forEach((t) => t.stop());
      };
      recorderRef.current = recorder;
      recorder.start();
      setRecording(true);
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
    } catch {
      /* mic denied — attach still works */
    }
  }

  function stop() {
    recorderRef.current?.stop();
    recorderRef.current = null;
    if (timerRef.current) clearInterval(timerRef.current);
    setRecording(false);
  }

  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");

  if (recording) {
    return (
      <div className="flex items-center gap-3 rounded-md border border-input px-3 py-2">
        <span className="size-2.5 animate-pulse rounded-full bg-destructive" />
        <span className="text-sm font-medium text-ink tabular-nums">
          {mm}:{ss}
        </span>
        <Button type="button" variant="soft" size="sm" className="ml-auto" onClick={stop}>
          <Square />
          Stop
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <input
        ref={inputRef}
        type="file"
        accept="audio/*"
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) onFile(f);
        }}
      />
      {canRecord ? (
        <Button type="button" variant="ghost" size="sm" onClick={start}>
          <Mic />
          Record voice
        </Button>
      ) : null}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => inputRef.current?.click()}
      >
        <Paperclip />
        Attach audio
      </Button>
    </div>
  );
}
