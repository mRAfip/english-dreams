import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStudents } from "@/lib/student/directory";
import { getDownloadUrl } from "@/lib/r2/presign";
import { isR2Configured } from "@/lib/r2/client";
import { courseIdsForStudents } from "@/lib/student/course";
import { listCourseOptions } from "@/lib/content/queries";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { TEACHING_DAYS_PER_WEEK } from "@/types/content";
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
//
// Completion is measured against THE STUDENT'S OWN COURSE. Courses have
// different lengths, so there is no single "60 days" to finish — a certificate
// means "completed <course>", and the denominator is that course's authored day
// count. A student with no course assigned can never be "ready".

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
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
    content_weeks: Embedded<{ week_number: number; course_id: string }>;
  }>;
};
type Embedded<T> = T | T[] | null;
function one<T>(v: Embedded<T> | undefined): T | null {
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

/**
 * Completion status against the student's own course length. `totalDays` of 0
 * means no course assigned (or an empty one) — never "ready", since there is
 * nothing to have completed.
 */
function statusFor(
  daysCompleted: number,
  totalDays: number,
  hasCertificate: boolean,
): CertificateStatus {
  if (hasCertificate) return "issued";
  if (totalDays === 0) return "in_progress";
  if (daysCompleted >= totalDays) return "ready";
  if (daysCompleted >= totalDays - NEARING_COMPLETION_DAYS) return "nearing";
  return "in_progress";
}

/** Teaching days each course has been authored to, keyed by course id. */
async function courseDayCounts(): Promise<Map<string, number>> {
  const supabase = await createServerClient();
  const courses = await listCourseOptions();
  const counts = new Map<string, number>();
  if (courses.length === 0) return counts;

  const { data } = await supabase.from("content_weeks").select("course_id");
  const weeksByCourse = new Map<string, number>();
  for (const w of (data ?? []) as { course_id: string }[]) {
    weeksByCourse.set(w.course_id, (weeksByCourse.get(w.course_id) ?? 0) + 1);
  }
  for (const course of courses) {
    counts.set(
      course.id,
      (weeksByCourse.get(course.id) ?? 0) * TEACHING_DAYS_PER_WEEK,
    );
  }
  return counts;
}

/** All students with completion status + certificate, for the admin manager. */
export async function getCertificateStudents(): Promise<CertificateStudent[]> {
  const students = await getStudents();
  if (students.length === 0) return [];
  const ids = students.map((s) => s.id);

  const admin = createAdminClient();
  const [
    { data: progress },
    { data: attempts },
    { data: certs },
    courseByStudent,
    dayCountByCourse,
  ] = await Promise.all([
    admin
      .from("student_day_progress")
      .select(
        "user_id, task_completed, updated_at, content_days!inner(weekday, content_weeks!inner(week_number, course_id))",
      )
      .in("user_id", ids)
      .eq("task_completed", true),
    admin
      .from("student_quiz_attempts")
      .select("user_id, score")
      .in("user_id", ids),
    admin
      .from("certificates")
      .select("student_id, r2_key, file_name, issued_at")
      .in("student_id", ids),
    courseIdsForStudents(ids),
    courseDayCounts(),
  ]);

  // Distinct completed teaching-day numbers + the latest completion time.
  const completedDays = new Map<string, Set<number>>();
  const lastCompletedAt = new Map<string, string>();
  for (const row of (progress ?? []) as ProgressRow[]) {
    const day = one(row.content_days);
    const week = one(day?.content_weeks);
    if (!day?.weekday || !week?.week_number) continue;
    // Only count days of the course the student is on now — rows left behind by
    // a course change belong to their old course's completion, not this one's.
    if (week.course_id !== courseByStudent.get(row.user_id)) continue;
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
    const courseId = courseByStudent.get(s.id) ?? null;
    const totalDays = courseId ? (dayCountByCourse.get(courseId) ?? 0) : 0;
    const finished = totalDays > 0 && daysCompleted >= totalDays;
    const finishedAt = lastCompletedAt.get(s.id);

    return {
      id: s.id,
      name: s.name,
      email: s.email,
      avatarUrl: s.avatarUrl,
      daysCompleted,
      totalDays,
      finalScore,
      status: statusFor(daysCompleted, totalDays, certificate !== null),
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

  const c = data as {
    r2_key: string;
    file_name: string | null;
    issued_at: string;
  };
  return {
    fileKey: c.r2_key,
    fileName: c.file_name ?? "certificate",
    issuedAt: formatDate(c.issued_at),
    downloadUrl: isR2Configured()
      ? getDownloadUrl(c.r2_key, "attachment")
      : null,
  };
}
