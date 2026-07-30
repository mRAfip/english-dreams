import { createClient } from "@/lib/supabase/server";
import type { CurrentUser } from "@/lib/auth/guards";
import { formatMessageTime } from "@/lib/inbox/format";
import { participantInfo } from "@/lib/inbox/participants";
import { allowedContactIds, canMessage } from "@/lib/inbox/access";
import type { InboxEntry, Message, Participant, Thread } from "@/types/message";

// Inbox reads, backed by the messaging tables (0011). Server-only. The list is
// PEOPLE-first: it merges everyone the viewer may message (the permission
// matrix) with the conversations that already exist. Participant names/roles are
// hydrated via the service-role client (see lib/inbox/participants) because RLS
// hides other users' profile/role rows from a non-admin.

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

type ConvBundle = {
  conversationId: string;
  otherId: string;
  otherLastRead: string | null;
  myLastRead: string | null;
  messages: MessageRow[];
  lastMessageAt: string;
};

function mapMessage(m: MessageRow, myId: string, otherLastRead: string | null): Message {
  const mine = m.sender_id === myId;
  const deleted = Boolean(m.deleted_at);
  return {
    id: m.id,
    senderId: m.sender_id ?? "",
    body: deleted ? "" : m.body,
    createdAt: m.created_at,
    sentAt: formatMessageTime(m.created_at),
    readAt:
      mine && !deleted && otherLastRead && otherLastRead >= m.created_at
        ? otherLastRead
        : null,
    deleted,
    attachment:
      deleted || !m.attachment_key
        ? null
        : {
            kind: (m.attachment_kind ?? "file") as "image" | "audio" | "file",
            name: m.attachment_name ?? "attachment",
            contentType: m.attachment_type,
            size: m.attachment_size,
            url: `/api/attachment/${m.id}`,
          },
  };
}

function unreadCount(messages: MessageRow[], myId: string, myLastRead: string | null): number {
  return messages.filter(
    (m) =>
      m.sender_id !== myId &&
      !m.deleted_at &&
      (!myLastRead || m.created_at > myLastRead),
  ).length;
}

/** Every conversation the user belongs to, indexed by the OTHER participant id. */
async function myConversations(userId: string): Promise<Map<string, ConvBundle>> {
  const supabase = await createClient();

  const { data: mine } = await supabase
    .from("conversation_participants")
    .select("conversation_id, last_read_at")
    .eq("user_id", userId);
  const myRows = (mine ?? []) as {
    conversation_id: string;
    last_read_at: string | null;
  }[];
  const convIds = myRows.map((r) => r.conversation_id);
  const byOther = new Map<string, ConvBundle>();
  if (convIds.length === 0) return byOther;

  const myLastRead = new Map(myRows.map((r) => [r.conversation_id, r.last_read_at]));

  const [{ data: others }, { data: msgs }, { data: convs }] = await Promise.all([
    supabase
      .from("conversation_participants")
      .select("conversation_id, user_id, last_read_at")
      .in("conversation_id", convIds)
      .neq("user_id", userId),
    supabase
      .from("messages")
      .select(
        "id, conversation_id, sender_id, body, created_at, deleted_at, attachment_key, attachment_name, attachment_type, attachment_size, attachment_kind",
      )
      .in("conversation_id", convIds)
      .order("created_at", { ascending: true }),
    supabase
      .from("conversations")
      .select("id, last_message_at")
      .in("id", convIds),
  ]);

  const otherByConv = new Map(
    ((others ?? []) as {
      conversation_id: string;
      user_id: string;
      last_read_at: string | null;
    }[]).map((r) => [r.conversation_id, r]),
  );
  const lastMessageAt = new Map(
    ((convs ?? []) as { id: string; last_message_at: string }[]).map((c) => [
      c.id,
      c.last_message_at,
    ]),
  );
  const msgsByConv = new Map<string, MessageRow[]>();
  for (const m of (msgs ?? []) as MessageRow[]) {
    const arr = msgsByConv.get(m.conversation_id) ?? [];
    arr.push(m);
    msgsByConv.set(m.conversation_id, arr);
  }

  for (const convId of convIds) {
    const other = otherByConv.get(convId);
    if (!other) continue;
    byOther.set(other.user_id, {
      conversationId: convId,
      otherId: other.user_id,
      otherLastRead: other.last_read_at,
      myLastRead: myLastRead.get(convId) ?? null,
      messages: msgsByConv.get(convId) ?? [],
      lastMessageAt: lastMessageAt.get(convId) ?? "",
    });
  }
  return byOther;
}

/** People-first inbox: everyone the user may message + any existing thread. */
export async function getInbox(me: CurrentUser): Promise<InboxEntry[]> {
  const [convByOther, contacts] = await Promise.all([
    myConversations(me.id),
    allowedContactIds(me),
  ]);

  // Union of allowed contacts and anyone I already have a thread with.
  const roleByContact = new Map(contacts.map((c) => [c.id, c.role]));
  const ids = new Set<string>([...roleByContact.keys(), ...convByOther.keys()]);
  const info = await participantInfo([...ids]);

  const entries: InboxEntry[] = [...ids].map((id) => {
    const i = info.get(id);
    const withP: Participant = {
      id,
      name: i?.name || i?.email || "Unknown",
      role: i?.role ?? roleByContact.get(id) ?? "student",
      avatarUrl: i?.avatarUrl ?? null,
    };
    const conv = convByOther.get(id);
    const last = conv?.messages.at(-1);
    return {
      with: withP,
      conversationId: conv?.conversationId ?? null,
      preview: last
        ? last.deleted_at
          ? "Message deleted"
          : last.body
        : "",
      previewMine: last ? last.sender_id === me.id : false,
      unread: conv ? unreadCount(conv.messages, me.id, conv.myLastRead) : 0,
      lastActivity: last ? formatMessageTime(last.created_at) : "",
      lastActivityIso: last ? last.created_at : null,
    };
  });

  // Threads with activity first (newest on top), then everyone else by name.
  entries.sort((a, b) => {
    if (a.lastActivityIso && b.lastActivityIso)
      return b.lastActivityIso.localeCompare(a.lastActivityIso);
    if (a.lastActivityIso) return -1;
    if (b.lastActivityIso) return 1;
    return a.with.name.localeCompare(b.with.name);
  });

  return entries;
}

/** The thread with `otherId`: the person, the (maybe null) conversation, messages. */
export async function getThreadWith(
  me: CurrentUser,
  otherId: string,
): Promise<Thread | null> {
  const convByOther = await myConversations(me.id);
  const conv = convByOther.get(otherId);

  // Must either be allowed to message them, or already have a thread with them.
  if (!conv) {
    const allowed = await canMessage(me, otherId);
    if (!allowed) return null;
  }

  const info = await participantInfo([otherId]);
  const i = info.get(otherId);
  const withP: Participant = {
    id: otherId,
    name: i?.name || i?.email || "Unknown",
    role: i?.role ?? "student",
    avatarUrl: i?.avatarUrl ?? null,
  };

  const messages = conv
    ? conv.messages.map((m) => mapMessage(m, me.id, conv.otherLastRead))
    : [];

  return {
    with: withP,
    conversationId: conv?.conversationId ?? null,
    messages,
  };
}

/** Total unread across all of the user's conversations (for a nav badge). */
export async function unreadTotal(userId: string): Promise<number> {
  const convByOther = await myConversations(userId);
  let total = 0;
  for (const conv of convByOther.values()) {
    total += unreadCount(conv.messages, userId, conv.myLastRead);
  }
  return total;
}
