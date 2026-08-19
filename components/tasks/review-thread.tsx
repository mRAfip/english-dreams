"use client";

import * as React from "react";
import {
  Download,
  FileText,
  Loader2,
  Mic,
  Paperclip,
  SendHorizonal,
  Square,
  Volume2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/components/ui/toast";
import { ROLE_LABEL } from "@/lib/auth/roles";
import { formatMessageTime } from "@/lib/inbox/format";
import {
  postReviewComment,
  requestCommentAttachmentUploadUrl,
  type CommentAttachmentInput,
} from "@/lib/tasks/actions";
import { AudioPlayer } from "@/components/ui/audio-player";
import type { ReviewComment } from "@/types/task";
import type { Role } from "@/types/role";

// The realtime review conversation on a submission: trainer comments, student
// replies. Supports text, voice messages, and document/file attachments with filesize.

type AuthorInfo = { name: string; role: Role | null };

const MAX_BYTES = 25 * 1024 * 1024; // 25 MB limit

export function kindOf(file: File): "image" | "audio" | "file" {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("audio/")) return "audio";
  return "file";
}

export function formatSize(bytes: number | null | undefined): string {
  if (bytes == null || isNaN(bytes)) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function extFor(mime: string): string {
  if (mime.includes("mp4")) return "m4a";
  if (mime.includes("ogg")) return "ogg";
  if (mime.includes("mpeg")) return "mp3";
  return "webm";
}

export function ReviewThread({
  submissionId,
  meId,
  initialComments,
  authors,
  placeholder = "Write a comment",
  questionId = null,
}: {
  submissionId: string;
  meId: string;
  initialComments: ReviewComment[];
  authors: Record<string, AuthorInfo>;
  placeholder?: string;
  questionId?: string | null;
}) {
  const supabase = React.useMemo(() => createClient(), []);
  const [comments, setComments] = React.useState<ReviewComment[]>(initialComments);
  const [body, setBody] = React.useState("");
  const [file, setFile] = React.useState<File | null>(null);
  const [sending, setSending] = React.useState(false);

  // Recording state
  const [recording, setRecording] = React.useState(false);
  const [elapsed, setElapsed] = React.useState(0);

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const recorderRef = React.useRef<MediaRecorder | null>(null);
  const chunksRef = React.useRef<Blob[]>([]);
  const timerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const tempSeq = React.useRef(0);
  const endRef = React.useRef<HTMLDivElement>(null);

  // Names known from props + whoever has already commented.
  const nameMap = React.useMemo(() => {
    const m = new Map<string, AuthorInfo>(Object.entries(authors));
    for (const c of initialComments) {
      if (!m.has(c.authorId)) m.set(c.authorId, { name: c.authorName, role: c.authorRole });
    }
    return m;
  }, [authors, initialComments]);

  // Preview URL for pending local attachment file
  const previewUrl = React.useMemo(
    () => (file ? URL.createObjectURL(file) : null),
    [file],
  );
  React.useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const canRecord =
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices &&
    typeof window !== "undefined" &&
    "MediaRecorder" in window;

  React.useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [comments.length]);

  React.useEffect(() => {
    const channel = supabase
      .channel(`task-review:${submissionId}:${questionId || "overall"}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "task_review_comments",
          filter: `submission_id=eq.${submissionId}`,
        },
        (payload) => {
          const row = payload.new as {
            id: string;
            author_id: string | null;
            body: string;
            created_at: string;
            question_id?: string | null;
            attachment_key?: string | null;
            attachment_name?: string | null;
            attachment_type?: string | null;
            attachment_size?: number | null;
            attachment_kind?: "image" | "audio" | "file" | null;
          };
          if (row.author_id === meId) return; // my own echo — handled optimistically

          // Check if this comment belongs to this thread's scope (this question or overall)
          const targetQId = row.question_id || null;
          const currentQId = questionId || null;
          if (targetQId !== currentQId) return;

          setComments((prev) => {
            if (prev.some((c) => c.id === row.id)) return prev;
            const info = row.author_id ? nameMap.get(row.author_id) : undefined;
            return [
              ...prev,
              {
                id: row.id,
                authorId: row.author_id ?? "",
                authorName: info?.name ?? "Someone",
                authorRole: info?.role ?? null,
                body: row.body,
                createdAt: row.created_at,
                sentAt: formatMessageTime(row.created_at),
                questionId: row.question_id,
                attachment: row.attachment_key
                  ? {
                      url: `/api/task-comment-attachment/${row.id}`,
                      name: row.attachment_name ?? "attachment",
                      type: row.attachment_type ?? null,
                      size: row.attachment_size ?? null,
                      kind: row.attachment_kind ?? "file",
                      key: row.attachment_key,
                    }
                  : null,
              },
            ];
          });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, submissionId, meId, nameMap, questionId]);

  function pickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const chosen = e.target.files?.[0];
    e.target.value = "";
    if (!chosen) return;
    if (chosen.size > MAX_BYTES) {
      toast.error("File is too large", { description: "Maximum file size is 25 MB." });
      return;
    }
    setFile(chosen);
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunksRef.current.push(ev.data);
      };
      recorder.onstop = () => {
        const type = recorder.mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type });
        const voice = new File([blob], `voice-message.${extFor(type)}`, { type });
        setFile(voice);
        stream.getTracks().forEach((t) => t.stop());
      };
      recorderRef.current = recorder;
      recorder.start();
      setRecording(true);
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
    } catch (e) {
      toast.error("Microphone access denied", {
        description: e instanceof Error ? e.message : "Unable to access microphone.",
      });
    }
  }

  function stopRecording() {
    recorderRef.current?.stop();
    recorderRef.current = null;
    if (timerRef.current) clearInterval(timerRef.current);
    setRecording(false);
  }

  async function send() {
    const trimmed = body.trim();
    if ((!trimmed && !file) || sending || recording) return;

    setSending(true);
    const tempId = `temp-${tempSeq.current++}`;
    const me = nameMap.get(meId);
    const kind = file ? kindOf(file) : null;

    const optimisticAttachment = file && previewUrl
      ? {
          url: previewUrl,
          name: file.name,
          type: file.type || null,
          size: file.size,
          kind: kind!,
        }
      : null;

    const optimistic: ReviewComment = {
      id: tempId,
      authorId: meId,
      authorName: me?.name ?? "You",
      authorRole: me?.role ?? null,
      body: trimmed,
      createdAt: new Date().toISOString(),
      sentAt: "Now",
      questionId: questionId || null,
      attachment: optimisticAttachment,
    };

    setComments((prev) => [...prev, optimistic]);
    setBody("");
    setFile(null);

    try {
      let attachmentPayload: CommentAttachmentInput | null = null;
      if (file) {
        const ticket = await requestCommentAttachmentUploadUrl({
          submissionId,
          fileName: file.name,
        });

        const putRes = await fetch(ticket.uploadUrl, {
          method: "PUT",
          body: file,
          headers: file.type ? { "Content-Type": file.type } : undefined,
        });

        if (!putRes.ok) throw new Error(`Upload failed (${putRes.status})`);

        attachmentPayload = {
          key: ticket.key,
          name: file.name,
          type: file.type || null,
          size: file.size,
          kind: kindOf(file),
        };
      }

      const result = await postReviewComment(
        submissionId,
        trimmed,
        questionId ?? undefined,
        attachmentPayload,
      );

      setSending(false);

      if (result.ok) {
        setComments((prev) =>
          prev.map((c) =>
            c.id === tempId
              ? {
                  ...c,
                  id: result.id,
                  sentAt: formatMessageTime(result.createdAt),
                  attachment: c.attachment
                    ? { ...c.attachment, url: `/api/task-comment-attachment/${result.id}` }
                    : null,
                }
              : c,
          ),
        );
      } else {
        setComments((prev) => prev.filter((c) => c.id !== tempId));
        setBody(trimmed);
        toast.error("Couldn't post comment", { description: result.error });
      }
    } catch (e) {
      setSending(false);
      setComments((prev) => prev.filter((c) => c.id !== tempId));
      setBody(trimmed);
      toast.error("Couldn't upload attachment", {
        description: e instanceof Error ? e.message : "Upload error",
      });
    }
  }

  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");

  return (
    <div className="flex flex-col rounded-xl border border-border bg-card">
      <div className="max-h-80 min-h-24 flex-1 overflow-y-auto p-4">
        {comments.length === 0 ? (
          <p className="py-6 text-center text-sm text-mute">
            No comments yet. Start the conversation.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {comments.map((c) => {
              const mine = c.authorId === meId;
              return (
                <li
                  key={c.id}
                  className={cn("flex flex-col gap-1", mine ? "items-end" : "items-start")}
                >
                  <div className="flex items-center gap-2 text-xs text-mute">
                    <span className="font-semibold text-ink">{c.authorName}</span>
                    {c.authorRole ? (
                      <Badge variant="outline">{ROLE_LABEL[c.authorRole]}</Badge>
                    ) : null}
                    <span>{c.sentAt}</span>
                  </div>

                  <div
                    className={cn(
                      "max-w-[85%] flex flex-col gap-2 rounded-xl px-4 py-2.5 text-sm",
                      mine
                        ? "rounded-br-sm bg-primary text-primary-foreground"
                        : "rounded-bl-sm bg-secondary text-ink",
                    )}
                  >
                    {c.body ? <div className="whitespace-pre-wrap wrap-break-word">{c.body}</div> : null}

                    {c.attachment ? (
                      <div className="mt-1">
                        {c.attachment.kind === "audio" ? (
                          <div className="flex flex-col gap-1 rounded-lg bg-black/10 p-2 text-current">
                            <div className="flex items-center gap-1.5 text-xs font-semibold">
                              <Volume2 className="size-3.5" />
                              <span>Voice Message</span>
                              {c.attachment.size ? (
                                <span className="ml-auto text-[10px] opacity-75">
                                  {formatSize(c.attachment.size)}
                                </span>
                              ) : null}
                            </div>
                            <AudioPlayer
                              src={c.attachment.url}
                              variant="bubble"
                              compact
                              className="w-full"
                            />
                          </div>
                        ) : c.attachment.kind === "image" ? (
                          <div className="group relative overflow-hidden rounded-lg border border-black/10">
                            <img
                              src={c.attachment.url}
                              alt={c.attachment.name}
                              className="max-h-52 max-w-full rounded object-cover"
                            />
                            <div className="flex items-center justify-between gap-2 p-1.5 text-xs">
                              <span className="truncate font-medium">{c.attachment.name}</span>
                              <span className="shrink-0 opacity-75">{formatSize(c.attachment.size)}</span>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between gap-3 rounded-lg border border-black/10 bg-black/5 p-2.5 text-current">
                            <div className="flex items-center gap-2 overflow-hidden">
                              <FileText className="size-5 shrink-0" />
                              <div className="flex flex-col min-w-0">
                                <span className="truncate text-xs font-semibold">{c.attachment.name}</span>
                                {c.attachment.size ? (
                                  <span className="text-[10px] opacity-70">
                                    {formatSize(c.attachment.size)}
                                  </span>
                                ) : null}
                              </div>
                            </div>
                            <a
                              href={`${c.attachment.url}${c.attachment.url.includes("?") ? "&" : "?"}download=1`}
                              download={c.attachment.name}
                              target="_blank"
                              rel="noreferrer"
                              className={cn(
                                "flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors",
                                mine
                                  ? "bg-white/20 hover:bg-white/30 text-white"
                                  : "bg-primary/10 hover:bg-primary/20 text-primary",
                              )}
                            >
                              <Download className="size-3.5" />
                              <span>Download</span>
                            </a>
                          </div>
                        )}
                      </div>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <div ref={endRef} />
      </div>

      <input
        ref={fileInputRef}
        type="file"
        onChange={pickFile}
        className="hidden"
        aria-label="Upload document or file"
      />

      {/* Input container */}
      <div className="border-t border-border p-3 flex flex-col gap-2">
        {/* Recording active banner */}
        {recording ? (
          <div className="flex items-center justify-between rounded-lg bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">
            <div className="flex items-center gap-2">
              <span className="relative flex size-2.5">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-destructive opacity-75" />
                <span className="relative inline-flex size-2.5 rounded-full bg-destructive" />
              </span>
              <span>Recording voice message... ({mm}:{ss})</span>
            </div>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={stopRecording}
              className="h-7 gap-1 text-xs px-2.5"
            >
              <Square className="size-3 fill-current" />
              <span>Done</span>
            </Button>
          </div>
        ) : null}

        {/* Attachment preview banner */}
        {file && !recording ? (
          <div className="flex items-center justify-between rounded-lg bg-muted px-3 py-2 text-xs">
            <div className="flex items-center gap-2 overflow-hidden">
              {kindOf(file) === "audio" ? (
                <Mic className="size-4 shrink-0 text-primary" />
              ) : (
                <FileText className="size-4 shrink-0 text-primary" />
              )}
              <span className="truncate font-semibold text-ink">{file.name}</span>
              <span className="shrink-0 font-medium text-mute">({formatSize(file.size)})</span>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setFile(null)}
              className="size-6 text-mute hover:text-ink"
            >
              <X className="size-3.5" />
            </Button>
          </div>
        ) : null}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
          className="flex items-end gap-2"
        >
          <div className="flex items-center gap-1 shrink-0 pb-1.5">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={sending || recording}
              onClick={() => fileInputRef.current?.click()}
              title="Attach document or file"
              aria-label="Attach document or file"
              className="size-9 text-mute hover:text-ink hover:bg-muted"
            >
              <Paperclip className="size-4" />
            </Button>

            {canRecord ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={sending || recording || !!file}
                onClick={startRecording}
                title="Record voice message"
                aria-label="Record voice message"
                className="size-9 text-mute hover:text-ink hover:bg-muted"
              >
                <Mic className="size-4" />
              </Button>
            ) : null}
          </div>

          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            rows={1}
            placeholder={placeholder}
            aria-label="Comment"
            disabled={sending || recording}
            className="max-h-32 min-h-11 flex-1 resize-y rounded-md border border-input bg-card px-4 py-3 text-sm text-foreground placeholder:text-mute focus-visible:border-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          />

          <Button
            type="submit"
            size="icon"
            disabled={sending || recording || (!body.trim() && !file)}
            aria-label="Send"
          >
            {sending ? <Loader2 className="animate-spin" /> : <SendHorizonal />}
          </Button>
        </form>
      </div>
    </div>
  );
}
