"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MessageBubble } from "@/components/global/inbox/message-bubble";
import { MessageComposer, kindOf } from "@/components/global/inbox/message-composer";
import { toast } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/client";
import { ROLE_LABEL } from "@/lib/auth/roles";
import { formatMessageTime } from "@/lib/inbox/format";
import {
  deleteMessage,
  markConversationRead,
  requestMessageUploadUrl,
  sendMessage,
  startConversation,
} from "@/lib/inbox/actions";
import type { Message, Thread } from "@/types/message";

// One thread: the message stream + composer, kept live over Supabase Realtime.
// A thread may have no conversation row yet (you've never messaged this person);
// the first send creates it, then the channel subscription starts. Own messages
// are added optimistically and reconciled with the server row; the other side's
// arrive over the channel. Soft-deletes propagate as UPDATE events.

type MessageRow = {
  id: string;
  conversation_id: string;
  sender_id: string | null;
  body: string;
  created_at: string;
  deleted_at: string | null;
  attachment_key: string | null;
  attachment_name: string | null;
  attachment_type: string | null;
  attachment_size: number | null;
  attachment_kind: string | null;
};

function rowToMessage(row: MessageRow): Message {
  const deleted = Boolean(row.deleted_at);
  return {
    id: row.id,
    senderId: row.sender_id ?? "",
    body: deleted ? "" : row.body,
    createdAt: row.created_at,
    sentAt: formatMessageTime(row.created_at),
    readAt: null,
    deleted,
    attachment:
      deleted || !row.attachment_key
        ? null
        : {
            kind: (row.attachment_kind ?? "file") as "image" | "audio" | "file",
            name: row.attachment_name ?? "attachment",
            contentType: row.attachment_type,
            size: row.attachment_size,
            url: `/api/attachment/${row.id}`,
          },
  };
}

export function ConversationView({
  thread,
  meId,
  className,
}: {
  thread: Thread;
  meId: string;
  className?: string;
}) {
  const router = useRouter();
  const [messages, setMessages] = React.useState<Message[]>(thread.messages);
  const [conversationId, setConversationId] = React.useState<string | null>(
    thread.conversationId,
  );
  const endRef = React.useRef<HTMLDivElement>(null);
  const tempSeq = React.useRef(0);
  const supabase = React.useMemo(() => createClient(), []);
  const other = thread.with;

  // Keep the newest message in view — on open and after every change.
  React.useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  // Mark read on open (only once there's a conversation to mark).
  React.useEffect(() => {
    if (!conversationId) return;
    markConversationRead(conversationId);
    router.refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  // Live updates for this conversation (subscribes once a conversation exists).
  React.useEffect(() => {
    if (!conversationId) return;
    const channel = supabase
      .channel(`conversation:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const row = payload.new as MessageRow;
          setMessages((prev) => {
            if (prev.some((m) => m.id === row.id)) return prev;
            if (row.sender_id === meId) {
              const idx = prev.findIndex(
                (m) => m.id.startsWith("temp-") && m.body === row.body,
              );
              if (idx !== -1) {
                const next = [...prev];
                next[idx] = rowToMessage(row);
                return next;
              }
            }
            return [...prev, rowToMessage(row)];
          });
          if (row.sender_id !== meId) {
            markConversationRead(conversationId);
            router.refresh();
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const row = payload.new as MessageRow;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === row.id
                ? {
                    ...m,
                    deleted: Boolean(row.deleted_at),
                    body: row.deleted_at ? "" : row.body,
                  }
                : m,
            ),
          );
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, conversationId, meId, router]);

  async function send(body: string, file: File | null): Promise<boolean> {
    const tempId = `temp-${tempSeq.current++}`;
    const localUrl = file ? URL.createObjectURL(file) : null;
    const optimistic: Message = {
      id: tempId,
      senderId: meId,
      body,
      createdAt: new Date().toISOString(),
      sentAt: "Now",
      readAt: null,
      deleted: false,
      attachment:
        file && localUrl
          ? {
              kind: kindOf(file),
              name: file.name,
              contentType: file.type || null,
              size: file.size,
              url: localUrl,
            }
          : null,
    };
    setMessages((prev) => [...prev, optimistic]);

    const fail = (error: string) => {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      if (localUrl) URL.revokeObjectURL(localUrl);
      toast.error("Message not sent", { description: error });
      return false;
    };

    // Create the conversation on the first message.
    let id = conversationId;
    if (!id) {
      const started = await startConversation(other.id);
      if (!started.ok) return fail(started.error);
      id = started.conversationId;
      setConversationId(id);
    }

    // Upload the attachment straight to R2, then record its key with the message.
    let attachment = null as Parameters<typeof sendMessage>[2];
    if (file) {
      try {
        const { key, uploadUrl } = await requestMessageUploadUrl({
          conversationId: id,
          fileName: file.name,
        });
        const put = await fetch(uploadUrl, {
          method: "PUT",
          body: file,
          headers: file.type ? { "Content-Type": file.type } : undefined,
        });
        if (!put.ok) throw new Error(`Upload failed (${put.status})`);
        attachment = {
          key,
          name: file.name,
          contentType: file.type || null,
          size: file.size,
          kind: kindOf(file),
        };
      } catch (e) {
        return fail(e instanceof Error ? e.message : "Upload failed.");
      }
    }

    const result = await sendMessage(id, body, attachment);
    if (!result.ok) return fail(result.error);

    setMessages((prev) => {
      const withoutTemp = prev.filter((m) => m.id !== tempId);
      if (withoutTemp.some((m) => m.id === result.id)) return withoutTemp;
      return [
        ...withoutTemp,
        {
          ...optimistic,
          id: result.id,
          createdAt: result.createdAt,
          sentAt: formatMessageTime(result.createdAt),
          attachment: optimistic.attachment
            ? { ...optimistic.attachment, url: `/api/attachment/${result.id}` }
            : null,
        },
      ];
    });
    if (localUrl) URL.revokeObjectURL(localUrl);
    router.refresh();
    return true;
  }

  async function handleDelete(id: string) {
    const prev = messages;
    setMessages((cur) =>
      cur.map((m) => (m.id === id ? { ...m, deleted: true, body: "" } : m)),
    );
    const result = await deleteMessage(id);
    if (!result.ok) {
      setMessages(prev);
      toast.error("Couldn't delete message", { description: result.error });
    }
  }

  return (
    <section
      className={cn(
        "flex h-[calc(100dvh-12rem)] min-h-96 flex-col overflow-hidden rounded-xl border border-border bg-card",
        className,
      )}
    >
      <header className="flex items-center gap-3 border-b border-border p-4">
        <Link
          href="/inbox"
          aria-label="Back to inbox"
          className="rounded-full p-1.5 text-body transition-colors hover:bg-secondary lg:hidden"
        >
          <ArrowLeft className="size-4" />
        </Link>

        <Avatar>
          {other.avatarUrl && <AvatarImage src={other.avatarUrl} alt="" />}
          <AvatarFallback>{initials(other.name)}</AvatarFallback>
        </Avatar>

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate font-semibold text-ink">{other.name}</span>
            <Badge variant="outline">{ROLE_LABEL[other.role]}</Badge>
          </div>
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="m-auto max-w-xs text-center text-sm text-mute">
            No messages yet. Say hello to {other.name.split(" ")[0]}.
          </div>
        ) : (
          messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              mine={message.senderId === meId}
              onDelete={handleDelete}
            />
          ))
        )}
        <div ref={endRef} />
      </div>

      <MessageComposer
        onSend={send}
        placeholder={`Message ${other.name.split(" ")[0]}`}
      />
    </section>
  );
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}
