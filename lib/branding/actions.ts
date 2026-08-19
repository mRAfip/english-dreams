"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/guards";
import { buildBrandingBannerKey } from "@/lib/r2/keys";
import { isR2Configured } from "@/lib/r2/client";
import { getUploadUrl, deleteObject } from "@/lib/r2/presign";

type Result = { ok: true } | { ok: false; error: string };
export type BannerUploadTicket = { key: string; uploadUrl: string };

/** Step 1: Request R2 upload URL for a new branding banner (admin only). */
export async function requestBrandingBannerUploadUrl(input: {
  fileName: string;
}): Promise<BannerUploadTicket> {
  await requireRole("admin");
  if (!isR2Configured()) {
    throw new Error("R2 storage is not configured.");
  }

  const key = buildBrandingBannerKey(input.fileName);
  return { key, uploadUrl: getUploadUrl(key) };
}

/** Step 2: Save the uploaded banner key to Supabase, update the URL, and clean up the old file (admin only). */
export async function saveBrandingBanner(input: {
  key: string;
}): Promise<Result & { bannerUrl?: string }> {
  await requireRole("admin");
  if (!isR2Configured()) {
    return { ok: false, error: "R2 storage is not configured." };
  }

  const supabase = await createClient();

  // Find existing banner (if any) to clean up later
  const { data: existing } = await supabase
    .from("branding")
    .select("id, banner_key")
    .maybeSingle();

  const bannerUrl = `/api/branding/banner?v=${Date.now()}`;

  if (existing) {
    const { error } = await supabase
      .from("branding")
      .update({
        banner_key: input.key,
        banner_url: bannerUrl,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);

    if (error) return { ok: false, error: error.message };

    // Clean up the old banner file from R2
    if (existing.banner_key && existing.banner_key !== input.key) {
      await deleteObject(existing.banner_key).catch(() => {});
    }
  } else {
    const { error } = await supabase
      .from("branding")
      .insert({
        banner_key: input.key,
        banner_url: bannerUrl,
      });

    if (error) return { ok: false, error: error.message };
  }

  // Revalidate student dashboard so the new banner appears immediately
  revalidatePath("/student");

  return { ok: true, bannerUrl };
}

/** Remove the active banner (admin only). */
export async function removeBrandingBanner(): Promise<Result> {
  await requireRole("admin");

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("branding")
    .select("id, banner_key")
    .maybeSingle();

  if (!existing) {
    return { ok: true };
  }

  const { error } = await supabase
    .from("branding")
    .delete()
    .eq("id", existing.id);

  if (error) return { ok: false, error: error.message };

  if (existing.banner_key) {
    await deleteObject(existing.banner_key).catch(() => {});
  }

  revalidatePath("/student");
  return { ok: true };
}

/** Get the currently active branding banner. */
export async function getActiveBrandingBanner() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("branding")
    .select("banner_key, banner_url")
    .maybeSingle();

  return data || null;
}
