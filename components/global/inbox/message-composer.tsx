"use client";

import * as React from "react";
import {
  FileText,
  Loader2,
  Mic,
  Paperclip,
  SendHorizonal,
  Square,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AudioPlayer } from "@/components/ui/audio-player";

// The reply box. Enter sends, Shift+Enter breaks the line. A message can carry
// one attachment — a file/image picked with the paperclip, or a voice clip
// recorded with the mic (MediaRecorder). The parent handles the R2 upload; this
// just hands back the text and the File.

export type AttachmentKind = "image" | "audio" | "file";

export function kindOf(file: File): AttachmentKind {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("audio/")) return "audio";
  return "file";
}

function extFor(mime: string): string {
  if (mime.includes("mp4")) return "m4a";
  if (mime.includes("ogg")) return "ogg";
  if (mime.includes("mpeg")) return "mp3";
  return "webm";
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const MAX_BYTES = 25 * 1024 * 1024; // 25 MB

function RemoveButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Remove attachment"
      className="shrink-0 rounded-md p-1.5 text-mute transition-colors hover:text-ink"
    >
      <X className="size-4" />
    </button>
  );
}

export function MessageComposer({
  onSend,
  placeholder = "Write a message",
}: {
  onSend: (body: string, file: File | null) => Promise<boolean>;
  placeholder?: string;
}) {
  const [body, setBody] = React.useState("");
  const [file, setFile] = React.useState<File | null>(null);
  const [sending, setSending] = React.useState(false);
  const [recording, setRecording] = React.useState(false);
  const [elapsed, setElapsed] = React.useState(0);

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const recorderRef = React.useRef<MediaRecorder | null>(null);
  const chunksRef = React.useRef<Blob[]>([]);
  const timerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  // A local preview URL for the pending attachment (image/audio), revoked on change.
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

  function pickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const chosen = e.target.files?.[0];
    e.target.value = "";
    if (!chosen) return;
    if (chosen.size > MAX_BYTES) return;
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
    } catch {
      // Permission denied or no mic — silently stay in text mode.
    }
  }

  function stopRecording() {
    recorderRef.current?.stop();
    recorderRef.current = null;
    if (timerRef.current) clearInterval(timerRef.current);
    setRecording(false);
  }

  async function submit() {
    const trimmed = body.trim();
    if ((!trimmed && !file) || sending) return;
    setSending(true);
    const ok = await onSend(trimmed, file);
    setSending(false);
    if (ok) {
      setBody("");
      setFile(null);
    }
  }

  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");

  return (
    <div className="border-t border-border bg-card">
      {/* Pending-attachment preview */}
      {file && (
        <div className="px-4 pt-3">
          {kindOf(file) === "image" && previewUrl ? (
            // Image — just a thumbnail with a corner remove, WhatsApp-style.
            <div className="relative inline-block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl}
                alt=""
                className="size-20 rounded-lg border border-border object-cover"
              />
              <button
                type="button"
                onClick={() => setFile(null)}
                aria-label="Remove attachment"
                className="absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full bg-neutral-800 text-white shadow-sm transition-colors hover:bg-neutral-700"
              >
                <X className="size-3" />
              </button>
            </div>
          ) : kindOf(file) === "audio" && previewUrl ? (
            // Voice clip — just the player (no name/size).
            <div className="flex items-center gap-2">
              <AudioPlayer src={previewUrl} compact className="min-w-0 flex-1" />
              <RemoveButton onClick={() => setFile(null)} />
            </div>
          ) : (
            // Document — a tidy card with the real name + size.
            <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/50 p-2.5">
              <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-secondary text-mute">
                <FileText className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-ink">
                  {file.name}
                </div>
                <div className="text-xs text-mute">{formatSize(file.size)}</div>
              </div>
              <RemoveButton onClick={() => setFile(null)} />
            </div>
          )}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="flex items-end gap-2 p-4"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,audio/*,.pdf,.doc,.docx,.txt"
          className="sr-only"
          onChange={pickFile}
        />

        {recording ? (
          <div className="flex flex-1 items-center gap-3 rounded-md border border-input bg-card px-4 py-3">
            <span className="flex h-4 items-center gap-0.75" aria-hidden>
              {[0, 1, 2, 3, 4].map((i) => (
                <span
                  key={i}
                  className="h-full w-0.75 origin-center rounded-full bg-destructive"
                  style={{
                    animation: "soundbar 0.9s ease-in-out infinite",
                    animationDelay: `${i * 0.14}s`,
                  }}
                />
              ))}
            </span>
            <span className="text-sm font-medium text-ink tabular-nums">
              Recording {mm}:{ss}
            </span>
            <Button
              type="button"
              variant="soft"
              size="sm"
              className="ml-auto"
              onClick={stopRecording}
            >
              <Square />
              Stop
            </Button>
          </div>
        ) : (
          <>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Attach a file"
              disabled={sending}
              onClick={() => fileInputRef.current?.click()}
            >
              <Paperclip />
            </Button>

            {canRecord && !file && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Record a voice message"
                disabled={sending}
                onClick={startRecording}
              >
                <Mic />
              </Button>
            )}

            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
              rows={1}
              placeholder={placeholder}
              aria-label="Message"
              disabled={sending}
              className="max-h-32 min-h-11 flex-1 resize-y rounded-md border border-input bg-card px-4 py-3 text-sm text-foreground transition-colors placeholder:text-mute focus-visible:border-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            />

            <Button
              type="submit"
              size="icon"
              disabled={sending || (!body.trim() && !file)}
              aria-label="Send"
            >
              {sending ? (
                <Loader2 className="animate-spin" />
              ) : (
                <SendHorizonal />
              )}
            </Button>
          </>
        )}
      </form>
    </div>
  );
}
