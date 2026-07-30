"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Inbox } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { TableEmpty } from "@/components/ui/table";
import { SearchField } from "@/components/admin/directory-toolbar";
import { createClient } from "@/lib/supabase/client";
import { ROLE_LABEL } from "@/lib/auth/roles";
import type { InboxEntry } from "@/types/message";

// The people-first inbox rail: everyone the viewer may message, each linking to
// their thread at /inbox/u/[userId]. Subscribes to Realtime so a new message
// re-orders the list and refreshes unread counts.

export function ConversationList({
  entries,
  activeUserId,
  className,
}: {
  entries: InboxEntry[];
  activeUserId?: string;
  className?: string;
}) {
  const [query, setQuery] = React.useState("");
  const router = useRouter();
  const supabase = React.useMemo(() => createClient(), []);

  // Any message change in one of my threads re-renders the server list. RLS
  // scopes the stream to conversations I belong to.
  React.useEffect(() => {
    const channel = supabase
      .channel("inbox-list")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages" },
        () => router.refresh(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, router]);

  const term = query.trim().toLowerCase();
  const shown = term
    ? entries.filter((e) => e.with.name.toLowerCase().includes(term))
    : entries;

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <SearchField
        value={query}
        onChange={setQuery}
        placeholder="Search people"
        label="Search people"
        className="sm:w-full"
      />

      {shown.length === 0 ? (
        <TableEmpty
          icon={Inbox}
          message={
            term ? `No one matches "${query.trim()}".` : "No one to message yet."
          }
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {shown.map((entry) => (
            <li key={entry.with.id}>
              <ContactRow
                entry={entry}
                active={entry.with.id === activeUserId}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ContactRow({ entry, active }: { entry: InboxEntry; active: boolean }) {
  const unread = entry.unread > 0;

  return (
    <Link
      href={`/inbox/u/${entry.with.id}`}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-start gap-3 rounded-xl border p-4 transition-colors",
        active
          ? "border-mute/40 bg-muted"
          : "border-border bg-card hover:border-mute/40 hover:bg-muted",
      )}
    >
      <Avatar>
        {entry.with.avatarUrl && (
          <AvatarImage src={entry.with.avatarUrl} alt="" />
        )}
        <AvatarFallback>{initials(entry.with.name)}</AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <span
            className={cn(
              "truncate text-sm text-ink",
              unread ? "font-bold" : "font-semibold",
            )}
          >
            {entry.with.name}
          </span>
          {entry.lastActivity ? (
            <span className="shrink-0 text-xs text-mute">
              {entry.lastActivity}
            </span>
          ) : null}
        </div>

        <div className="mt-0.5 flex items-center gap-2">
          <Badge variant="outline">{ROLE_LABEL[entry.with.role]}</Badge>
        </div>

        {entry.preview ? (
          <p
            className={cn(
              "mt-1.5 truncate text-sm",
              unread ? "text-ink" : "text-body",
            )}
          >
            {entry.previewMine && "You: "}
            {entry.preview}
          </p>
        ) : (
          <p className="mt-1.5 truncate text-sm italic text-mute">
            No messages yet
          </p>
        )}
      </div>

      {unread && (
        <span className="mt-1 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
          {entry.unread}
        </span>
      )}
    </Link>
  );
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}
