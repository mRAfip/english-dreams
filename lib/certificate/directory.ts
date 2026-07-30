import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStudents } from "@/lib/student/directory";
import { getDownloadUrl } from "@/lib/r2/presign";
import { isR2Configured } from "@/lib/r2/client";
import { TEACHING_DAYS_PER_WEEK, TOTAL_TEACHING_DAYS } from "@/types/content";
import {
  NEARING_COMPLETION_DAYS,
  type CertificateStatus,
  type CertificateStudent,
  type IssuedCertificate,
} from "@/types/certificate";

// Certificate roster for the admin — every student with their completion status
// and issued certificate (if any). Progress/attempt/certificate rows are read
// with the service-role client because student_day_progress RLS is per-student
// (a student sees only their own); this loader is only reached from the
// admin-guarded page.

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function formatDate(iso: string): string {
  const d = new Date(iso);
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${day} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

type ProgressRow = {
  user_id: string;
  task_completed: boolean;
  updated_at: string;
  content_days: Embedded<{
    weekday: number;
    content_weeks: Embedded<{ week_number: number }>;
  }>;
};
type Embedded<T> = T | T[] | null;
function one<T>(v: Embedded<T> | undefined): T | null {
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

function statusFor(
  daysCompleted: number,
  hasCertificate: boolean,
): CertificateStatus {
  if (hasCertificate) return "issued";
  if (daysCompleted >= TOTAL_TEACHING_DAYS) return "ready";
  if (daysCompleted >= TOTAL_TEACHING_DAYS - NEARING_COMPLETION_DAYS)
    return "nearing";
  return "in_progress";
}

/** All students with completion status + certificate, for the admin manager. */
export async function getCertificateStudents(): Promise<CertificateStudent[]> {
  const students = await getStudents();
  if (students.length === 0) return [];
  const ids = students.map((s) => s.id);

  const admin = createAdminClient();
  const [{ data: progress }, { data: attempts }, { data: certs }] =
    await Promise.all([
      admin
        .from("student_day_progress")
        .select(
          "user_id, task_completed, updated_at, content_days!inner(weekday, content_weeks!inner(week_number))",
        )
        .in("user_id", ids)
        .eq("task_completed", true),
      admin.from("student_quiz_attempts").select("user_id, score").in("user_id", ids),
      admin
        .from("certificates")
        .select("student_id, r2_key, file_name, issued_at")
        .in("student_id", ids),
    ]);

  // Distinct completed teaching-day numbers + the latest completion time.
  const completedDays = new Map<string, Set<number>>();
  const lastCompletedAt = new Map<string, string>();
  for (const row of (progress ?? []) as ProgressRow[]) {
    const day = one(row.content_days);
    const week = one(day?.content_weeks);
    if (!day?.weekday || !week?.week_number) continue;
    const dayNumber =
      (week.week_number - 1) * TEACHING_DAYS_PER_WEEK + day.weekday;
    const set = completedDays.get(row.user_id) ?? new Set<number>();
    set.add(dayNumber);
    completedDays.set(row.user_id, set);
    const prev = lastCompletedAt.get(row.user_id);
    if (!prev || row.updated_at > prev) {
      lastCompletedAt.set(row.user_id, row.updated_at);
    }
  }

  const scores = new Map<string, number[]>();
  for (const a of (attempts ?? []) as { user_id: string; score: number }[]) {
    const arr = scores.get(a.user_id) ?? [];
    arr.push(a.score);
    scores.set(a.user_id, arr);
  }

  const configured = isR2Configured();
  const certByStudent = new Map<string, IssuedCertificate>();
  for (const c of (certs ?? []) as {
    student_id: string;
    r2_key: string;
    file_name: string | null;
    issued_at: string;
  }[]) {
    certByStudent.set(c.student_id, {
      fileKey: c.r2_key,
      fileName: c.file_name ?? "certificate",
      issuedAt: formatDate(c.issued_at),
      downloadUrl: configured ? getDownloadUrl(c.r2_key, "attachment") : null,
    });
  }

  return students.map((s) => {
    const daysCompleted = completedDays.get(s.id)?.size ?? 0;
    const scoreArr = scores.get(s.id) ?? [];
    const finalScore =
      scoreArr.length === 0
        ? null
        : Math.round(scoreArr.reduce((sum, n) => sum + n, 0) / scoreArr.length);
    const certificate = certByStudent.get(s.id) ?? null;
    const finished = daysCompleted >= TOTAL_TEACHING_DAYS;
    const finishedAt = lastCompletedAt.get(s.id);

    return {
      id: s.id,
      name: s.name,
      email: s.email,
      avatarUrl: s.avatarUrl,
      daysCompleted,
      totalDays: TOTAL_TEACHING_DAYS,
      finalScore,
      status: statusFor(daysCompleted, certificate !== null),
      completedAt: finished && finishedAt ? formatDate(finishedAt) : null,
      certificate,
    };
  });
}

/** The signed-in student's own certificate (or null). Reads via RLS. */
export async function getStudentCertificate(
  userId: string,
): Promise<IssuedCertificate | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("certificates")
    .select("r2_key, file_name, issued_at")
    .eq("student_id", userId)
    .maybeSingle();
  if (!data) return null;

  const c = data as { r2_key: string; file_name: string | null; issued_at: string };
  return {
    fileKey: c.r2_key,
    fileName: c.file_name ?? "certificate",
    issuedAt: formatDate(c.issued_at),
    downloadUrl: isR2Configured() ? getDownloadUrl(c.r2_key, "attachment") : null,
  };
}
