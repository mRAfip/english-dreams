"use client";

import { Check, CheckCheck, Download, FileText, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { AudioPlayer } from "@/components/ui/audio-player";
import type { Message, MessageAttachment } from "@/types/message";

// One message. The viewer's own messages sit right on the lime brand fill; the
// other person's sit left on the sage surface. Own, non-deleted messages reveal
// a delete button on hover.

export function MessageBubble({
  message,
  mine,
  onDelete,
}: {
  message: Message;
  mine: boolean;
  onDelete?: (id: string) => void;
}) {
  const imageOnly =
    !message.deleted &&
    message.attachment?.kind === "image" &&
    !message.body;

  return (
    <div
      className={cn(
        "group flex flex-col gap-1",
        mine ? "items-end" : "items-start",
      )}
    >
      <div
        className={cn(
          "flex max-w-[85%] items-center gap-2 sm:max-w-[75%]",
          mine ? "flex-row" : "flex-row-reverse",
        )}
      >
        {mine && !message.deleted && onDelete ? (
          <button
            type="button"
            onClick={() => onDelete(message.id)}
            aria-label="Delete message"
            className="shrink-0 rounded-md p-1.5 text-mute opacity-0 transition-opacity hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
          >
            <Trash2 className="size-4" />
          </button>
        ) : null}

        {message.deleted ? (
          <div
            className={cn(
              "rounded-xl border border-dashed border-border px-4 py-3 text-sm italic text-mute",
              mine ? "rounded-br-sm" : "rounded-bl-sm",
            )}
          >
            {mine ? "You deleted this message" : "This message was deleted"}
          </div>
        ) : imageOnly && message.attachment ? (
          // A bare image needs no coloured bubble around it.
          <AttachmentView attachment={message.attachment} mine={mine} bare />
        ) : (
          <div
            className={cn(
              "flex min-w-0 flex-col gap-2 rounded-xl px-4 py-3 text-sm",
              mine
                ? "rounded-br-sm bg-primary text-primary-foreground"
                : "rounded-bl-sm bg-secondary text-ink",
            )}
          >
            {message.attachment && (
              <AttachmentView attachment={message.attachment} mine={mine} />
            )}
            {message.body && (
              <span className="whitespace-pre-wrap wrap-break-word">
                {message.body}
              </span>
            )}
          </div>
        )}
      </div>

      <div
        className={cn(
          "flex items-center gap-1 px-1 text-xs text-mute",
          mine ? "justify-end" : "justify-start",
        )}
      >
        {message.sentAt}
        {/* Read receipts only make sense on messages the viewer sent. */}
        {mine &&
          !message.deleted &&
          (message.readAt ? (
            <CheckCheck className="size-3.5 text-positive" aria-label="Read" />
          ) : (
            <Check className="size-3.5" aria-label="Sent" />
          ))}
      </div>
    </div>
  );
}

function formatSize(bytes: number | null): string | null {
  if (bytes === null) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function AttachmentView({
  attachment,
  mine,
  bare = false,
}: {
  attachment: MessageAttachment;
  mine: boolean;
  bare?: boolean;
}) {
  if (attachment.kind === "image") {
    return (
      <a href={attachment.url} target="_blank" rel="noopener noreferrer">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={attachment.url}
          alt={attachment.name}
          className={cn(
            "max-h-72 w-auto max-w-full object-cover",
            bare ? "rounded-xl" : "rounded-lg",
          )}
        />
      </a>
    );
  }

  if (attachment.kind === "audio") {
    return (
      <AudioPlayer
        src={attachment.url}
        variant="bubble"
        compact
        className="w-56 max-w-full sm:w-64"
      />
    );
  }

  const size = formatSize(attachment.size);
  return (
    <a
      href={`${attachment.url}?download`}
      className={cn(
        "flex items-center gap-2.5 rounded-lg px-3 py-2 transition-colors",
        mine
          ? "bg-primary-foreground/15 hover:bg-primary-foreground/25"
          : "bg-card hover:bg-muted",
      )}
    >
      <FileText className="size-5 shrink-0" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">
          {attachment.name}
        </span>
        {size && <span className="block text-xs opacity-70">{size}</span>}
      </span>
      <Download className="size-4 shrink-0 opacity-70" />
    </a>
  );
}
