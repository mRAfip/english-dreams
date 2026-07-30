"use client";

import * as React from "react";
import { Loader2, SendHorizonal } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { ROLE_LABEL } from "@/lib/auth/roles";
import { formatMessageTime } from "@/lib/inbox/format";
import { postReviewComment } from "@/lib/tasks/actions";
import type { ReviewComment } from "@/types/task";
import type { Role } from "@/types/role";

// The realtime review conversation on a submission: trainer comments, student
// replies. Mirrors the inbox thread (Supabase Realtime on task_review_comments).

type AuthorInfo = { name: string; role: Role | null };

export function ReviewThread({
  submissionId,
  meId,
  initialComments,
  authors,
  placeholder = "Write a comment",
}: {
  submissionId: string;
  meId: string;
  initialComments: ReviewComment[];
  authors: Record<string, AuthorInfo>;
  placeholder?: string;
}) {
  const supabase = React.useMemo(() => createClient(), []);
  const [comments, setComments] = React.useState<ReviewComment[]>(initialComments);
  const [body, setBody] = React.useState("");
  const [sending, setSending] = React.useState(false);
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

  React.useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [comments.length]);

  React.useEffect(() => {
    const channel = supabase
      .channel(`task-review:${submissionId}`)
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
          };
          if (row.author_id === meId) return; // my own echo — handled optimistically
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
              },
            ];
          });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, submissionId, meId, nameMap]);

  async function send() {
    const trimmed = body.trim();
    if (!trimmed || sending) return;
    setSending(true);
    const tempId = `temp-${tempSeq.current++}`;
    const me = nameMap.get(meId);
    const optimistic: ReviewComment = {
      id: tempId,
      authorId: meId,
      authorName: me?.name ?? "You",
      authorRole: me?.role ?? null,
      body: trimmed,
      createdAt: new Date().toISOString(),
      sentAt: "Now",
    };
    setComments((prev) => [...prev, optimistic]);
    setBody("");

    const result = await postReviewComment(submissionId, trimmed);
    setSending(false);
    if (result.ok) {
      setComments((prev) =>
        prev.map((c) =>
          c.id === tempId
            ? { ...c, id: result.id, sentAt: formatMessageTime(result.createdAt) }
            : c,
        ),
      );
    } else {
      setComments((prev) => prev.filter((c) => c.id !== tempId));
      setBody(trimmed);
    }
  }

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
                      "max-w-[85%] whitespace-pre-wrap wrap-break-word rounded-xl px-4 py-2.5 text-sm",
                      mine
                        ? "rounded-br-sm bg-primary text-primary-foreground"
                        : "rounded-bl-sm bg-secondary text-ink",
                    )}
                  >
                    {c.body}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="flex items-end gap-2 border-t border-border p-3"
      >
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
          disabled={sending}
          className="max-h-32 min-h-11 flex-1 resize-y rounded-md border border-input bg-card px-4 py-3 text-sm text-foreground placeholder:text-mute focus-visible:border-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        />
        <Button type="submit" size="icon" disabled={sending || !body.trim()} aria-label="Send">
          {sending ? <Loader2 className="animate-spin" /> : <SendHorizonal />}
        </Button>
      </form>
    </div>
  );
}
