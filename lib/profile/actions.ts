"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/guards";
import { buildAvatarKey } from "@/lib/r2/keys";
import { isR2Configured } from "@/lib/r2/client";
import { getUploadUrl, deleteObject } from "@/lib/r2/presign";

// Self-service profile updates for the signed-in user. Name and avatar write to
// the user's own profiles row (RLS allows own-row updates); password goes
// through Supabase Auth. None of these need the service role.

type Result = { ok: true } | { ok: false; error: string };

/** Update the signed-in user's display name. */
export async function updateProfileName(input: {
  fullName: string;
}): Promise<Result> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const fullName = input.fullName.trim();
  if (!fullName) return { ok: false, error: "Name can't be empty." };
  if (fullName.length > 80) return { ok: false, error: "Name is too long." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ full_name: fullName })
    .eq("id", user.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/profile");
  return { ok: true };
}

/** Change the signed-in user's password. */
export async function updatePassword(input: {
  password: string;
}): Promise<Result> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not signed in." };

  if (input.password.length < 8) {
    return { ok: false, error: "Password must be at least 8 characters." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: input.password });
  if (error) return { ok: false, error: error.message };

  return { ok: true };
}

export type AvatarUploadTicket = { key: string; uploadUrl: string };

/** Step 1 of an avatar change: mint an R2 key + presigned PUT URL. */
export async function requestAvatarUploadUrl(input: {
  fileName: string;
}): Promise<AvatarUploadTicket> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not signed in.");
  if (!isR2Configured()) throw new Error("Photo uploads are unavailable.");

  const key = buildAvatarKey(user.id, input.fileName);
  return { key, uploadUrl: getUploadUrl(key) };
}

export type SaveAvatarResult =
  | { ok: true; avatarUrl: string }
  | { ok: false; error: string };

/**
 * Step 2: record the uploaded object. We store the R2 key (avatar_key) and point
 * avatar_url at our serving route, which redirects to a fresh presigned URL — so
 * the bucket stays private and the stored URL never expires. The `?v=` cache-busts
 * so a new photo shows immediately.
 */
export async function saveAvatar(input: {
  key: string;
}): Promise<SaveAvatarResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not signed in." };
  if (!isR2Configured()) {
    return { ok: false, error: "Photo uploads are unavailable." };
  }

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("profiles")
    .select("avatar_key")
    .eq("id", user.id)
    .maybeSingle();

  const avatarUrl = `/api/avatar/${user.id}?v=${Date.now()}`;
  const { error } = await supabase
    .from("profiles")
    .update({ avatar_key: input.key, avatar_url: avatarUrl })
    .eq("id", user.id);
  if (error) return { ok: false, error: error.message };

  // Best-effort cleanup of the previous avatar object.
  const oldKey = (existing as { avatar_key: string | null } | null)?.avatar_key;
  if (oldKey && oldKey !== input.key) {
    await deleteObject(oldKey).catch(() => {});
  }

  revalidatePath("/profile");
  return { ok: true, avatarUrl };
}
