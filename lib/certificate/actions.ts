"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/guards";
import { buildCertificateKey } from "@/lib/r2/keys";
import { getUploadUrl, deleteObject } from "@/lib/r2/presign";

// Admin actions for issuing completion certificates. The file is uploaded
// directly to R2 from the browser (presigned PUT); this records the object key
// on the student's certificate row. Every action re-checks the caller is admin.

async function assertAdmin(): Promise<string> {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") throw new Error("Not authorized");
  return user.id;
}

export type UploadTicket = { key: string; uploadUrl: string };

/** Step 1: mint an R2 key + presigned PUT URL for a student's certificate. */
export async function requestCertificateUploadUrl(input: {
  studentId: string;
  fileName: string;
}): Promise<UploadTicket> {
  await assertAdmin();
  const key = buildCertificateKey(input.studentId, input.fileName);
  return { key, uploadUrl: getUploadUrl(key) };
}

export type IssueCertificateResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Step 2: record the uploaded object as the student's certificate. Upserts on
 * student_id (one certificate per student); a replaced object is deleted from R2.
 */
export async function issueCertificate(input: {
  studentId: string;
  key: string;
  fileName: string;
  contentType?: string | null;
  sizeBytes?: number | null;
}): Promise<IssueCertificateResult> {
  const adminId = await assertAdmin();
  if (!input.studentId || !input.key) {
    return { ok: false, error: "Missing student or file." };
  }

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("certificates")
    .select("r2_key")
    .eq("student_id", input.studentId)
    .maybeSingle();

  const { error } = await supabase.from("certificates").upsert(
    {
      student_id: input.studentId,
      r2_key: input.key,
      file_name: input.fileName,
      content_type: input.contentType ?? null,
      size_bytes: input.sizeBytes ?? null,
      issued_by: adminId,
      issued_at: new Date().toISOString(),
    },
    { onConflict: "student_id" },
  );
  if (error) return { ok: false, error: error.message };

  const oldKey = (existing as { r2_key: string } | null)?.r2_key;
  if (oldKey && oldKey !== input.key) {
    await deleteObject(oldKey).catch(() => {});
  }

  revalidatePath("/admin/certificates");
  revalidatePath("/student/certificates");
  return { ok: true };
}

export type RevokeCertificateResult =
  | { ok: true }
  | { ok: false; error: string };

/** Remove a student's certificate, from both the DB and R2. */
export async function revokeCertificate(input: {
  studentId: string;
}): Promise<RevokeCertificateResult> {
  await assertAdmin();
  if (!input.studentId) return { ok: false, error: "Missing student." };

  const supabase = await createClient();
  const { data: row } = await supabase
    .from("certificates")
    .select("r2_key")
    .eq("student_id", input.studentId)
    .maybeSingle();

  const { error } = await supabase
    .from("certificates")
    .delete()
    .eq("student_id", input.studentId);
  if (error) return { ok: false, error: error.message };

  const key = (row as { r2_key: string } | null)?.r2_key;
  if (key) await deleteObject(key).catch(() => {});

  revalidatePath("/admin/certificates");
  revalidatePath("/student/certificates");
  return { ok: true };
}
