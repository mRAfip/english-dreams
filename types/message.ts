// Inbox — one thread per pair of people. Same shape for every role; who may
// message whom is enforced by lib/auth + DB policies, not by these types.

import type { Role } from "@/types/role";

/** The other person in a thread. The viewer is never listed as a participant. */
export type Participant = {
  id: string;
  name: string;
  role: Role;
  avatarUrl: string | null;
};

/** A file / image / voice clip attached to a message, served from R2. */
export type MessageAttachment = {
  kind: "image" | "audio" | "file";
  name: string;
  contentType: string | null;
  size: number | null;
  /** Serving URL — /api/attachment/<messageId>, or a local blob while sending. */
  url: string;
};

export type Message = {
  id: string;
  /** The sender's user id (compare against the viewer's own id). */
  senderId: string;
  body: string;
  /** ISO timestamp the message was created — formatted for display in the UI. */
  createdAt: string;
  /** Display time, e.g. "09:14" or "Fri". */
  sentAt: string;
  /** Null on messages the viewer sent that the other side hasn't opened. */
  readAt: string | null;
  /** True once soft-deleted; the body is withheld and a placeholder shown. */
  deleted: boolean;
  /** Attached file/image/voice clip, if any. */
  attachment: MessageAttachment | null;
};

export type Conversation = {
  id: string;
  /** Who the viewer is talking to. */
  with: Participant;
  /** What the thread is about — shown under the name in the list. */
  subject: string;
  messages: Message[];
  unread: number;
  /** Display timestamp of the last message, for the list. */
  lastActivity: string;
};

/**
 * A row in the people-first inbox list: everyone the viewer may message, each
 * with their conversation (if one exists yet) and a preview of the last message.
 */
export type InboxEntry = {
  with: Participant;
  /** Null until the first message creates the thread. */
  conversationId: string | null;
  /** Last message text (or the deleted placeholder), "" when no messages yet. */
  preview: string;
  previewMine: boolean;
  unread: number;
  lastActivity: string;
  /** ISO of the last message, for sorting; null when there are none. */
  lastActivityIso: string | null;
};

/** One open thread: the other person plus the message stream (may be empty). */
export type Thread = {
  with: Participant;
  /** Null when no messages have been exchanged yet. */
  conversationId: string | null;
  messages: Message[];
};

