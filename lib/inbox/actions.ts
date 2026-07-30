"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth/guards";
import { canMessage } from "@/lib/inbox/access";
import { buildMessageAttachmentKey } from "@/lib/r2/keys";
import { getUploadUrl } from "@/lib/r2/presign";

// Inbox write actions. Reads/writes of messages go through the user's own
// (RLS-enforced) client; conversation CREATION goes through the service-role
// client AFTER canMessage() validates the pairing — the permission matrix lives
// in code, RLS only guarantees membership.

function pairKey(a: string, b: string): string {
  return [a, b].sort().join(":");
}

export type StartConversationResult =
  | { ok: true; conversationId: string }
  | { ok: false; error: string };

/**
 * Open (or reuse) the 1:1 thread between the signed-in user and `otherUserId`.
 * Returns the conversation id to navigate to.
 */
export async function startConversation(
  otherUserId: string,
): Promise<StartConversationResult> {
  const me = await getCurrentUser();
  if (!me) return { ok: false, error: "Not signed in." };

  const allowed = await canMessage(me, otherUserId);
  if (!allowed) {
    return { ok: false, error: "You can't message this person." };
  }

  const admin = createAdminClient();
  const key = pairKey(me.id, otherUserId);

  // Reuse an existing thread for this pair if there is one.
  const { data: existing } = await admin
    .from("conversations")
    .select("id")
    .eq("pair_key", key)
    .maybeSingle();
  if (existing) {
    return { ok: true, conversationId: (existing as { id: string }).id };
  }

  const { data: created, error: convError } = await admin
    .from("conversations")
    .insert({ pair_key: key })
    .select("id")
    .single();
  if (convError || !created) {
    return { ok: false, error: convError?.message ?? "Could not start the chat." };
  }
  const conversationId = (created as { id: string }).id;

  const { error: partError } = await admin
    .from("conversation_participants")
    .insert([
      { conversation_id: conversationId, user_id: me.id },
      { conversation_id: conversationId, user_id: otherUserId },
    ]);
  if (partError) {
    return { ok: false, error: partError.message };
  }

  revalidatePath("/inbox");
  return { ok: true, conversationId };
}

export type AttachmentKind = "image" | "audio" | "file";

export type MessageAttachmentInput = {
  key: string;
  name: string;
  contentType: string | null;
  size: number | null;
  kind: AttachmentKind;
};

export type UploadTicket = { key: string; uploadUrl: string };

/**
 * Mint an R2 key + presigned PUT for a message attachment. Requires the caller
 * to be a member of the conversation (so a stranger can't obtain upload URLs).
 */
export async function requestMessageUploadUrl(input: {
  conversationId: string;
  fileName: string;
}): Promise<UploadTicket> {
  const me = await getCurrentUser();
  if (!me) throw new Error("Not signed in.");

  const supabase = await createClient();
  const { data: member } = await supabase
    .from("conversation_participants")
    .select("conversation_id")
    .eq("conversation_id", input.conversationId)
    .eq("user_id", me.id)
    .maybeSingle();
  if (!member) throw new Error("Not a member of this conversation.");

  const key = buildMessageAttachmentKey(input.conversationId, input.fileName);
  return { key, uploadUrl: getUploadUrl(key) };
}

export type SendMessageResult =
  | { ok: true; id: string; createdAt: string }
  | { ok: false; error: string };

/** Post a message to a conversation the user belongs to (RLS enforces both). */
export async function sendMessage(
  conversationId: string,
  body: string,
  attachment?: MessageAttachmentInput | null,
): Promise<SendMessageResult> {
  const me = await getCurrentUser();
  if (!me) return { ok: false, error: "Not signed in." };

  const trimmed = body.trim();
  if (!trimmed && !attachment) return { ok: false, error: "Message is empty." };
  if (trimmed.length > 4000)
    return { ok: false, error: "Message is too long." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversationId,
      sender_id: me.id,
      body: trimmed,
      attachment_key: attachment?.key ?? null,
      attachment_name: attachment?.name ?? null,
      attachment_type: attachment?.contentType ?? null,
      attachment_size: attachment?.size ?? null,
      attachment_kind: attachment?.kind ?? null,
    })
    .select("id, created_at")
    .single();
  if (error || !data) {
    return { ok: false, error: error?.message ?? "Could not send." };
  }

  // Sending implies I've read everything up to now in this thread.
  await supabase
    .from("conversation_participants")
    .update({ last_read_at: (data as { created_at: string }).created_at })
    .eq("conversation_id", conversationId)
    .eq("user_id", me.id);

  revalidatePath("/inbox");
  return {
    ok: true,
    id: (data as { id: string }).id,
    createdAt: (data as { created_at: string }).created_at,
  };
}

export type DeleteMessageResult =
  | { ok: true }
  | { ok: false; error: string };

/** Soft-delete a message. RLS allows only the sender (or an admin). */
export async function deleteMessage(
  messageId: string,
): Promise<DeleteMessageResult> {
  const me = await getCurrentUser();
  if (!me) return { ok: false, error: "Not signed in." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("messages")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", messageId)
    .is("deleted_at", null)
    .select("id");
  if (error) return { ok: false, error: error.message };
  if (!data || data.length === 0) {
    return { ok: false, error: "You can only delete your own messages." };
  }

  revalidatePath("/inbox");
  return { ok: true };
}

/** Advance the user's read marker for a conversation to now. */
export async function markConversationRead(
  conversationId: string,
): Promise<void> {
  const me = await getCurrentUser();
  if (!me) return;
  const supabase = await createClient();
  await supabase
    .from("conversation_participants")
    .update({ last_read_at: new Date().toISOString() })
    .eq("conversation_id", conversationId)
    .eq("user_id", me.id);
}
