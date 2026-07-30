import { createClient } from "@/lib/supabase/server";

// The student directory — every user holding the 'student' role, with the
// trainer they're assigned to. Server-only.

export type FeeStatus = "paid" | "unpaid" | "waived";

export type StudentRow = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  joinedAt: string;
  joinedAtIso: string;
  trainerId: string | null;
  trainerName: string | null;
  /** Admin's temporary access switch. A student with no access row defaults to true. */
  accessEnabled: boolean;
  feeStatus: FeeStatus;
};

// A student with no student_access row is treated as fully enabled — the table
// is opt-in, so existing accounts are never locked out.
const DEFAULT_ACCESS: { accessEnabled: boolean; feeStatus: FeeStatus } = {
  accessEnabled: true,
  feeStatus: "unpaid",
};

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

/** All students, newest first, each with their assigned trainer (if any). */
export async function getStudents(): Promise<StudentRow[]> {
  const supabase = await createClient();

  const { data: assigns } = await supabase
    .from("user_role_assignments")
    .select("user_id, user_roles!inner(name)")
    .eq("user_roles.name", "student");

  const ids = ((assigns ?? []) as { user_id: string }[]).map((a) => a.user_id);
  if (ids.length === 0) return [];

  // Student profiles + their trainer links + access rows, in parallel.
  const [{ data: profiles }, { data: links }, { data: access }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name, email, avatar_url, created_at")
        .in("id", ids)
        .order("created_at", { ascending: false }),
      supabase
        .from("student_trainer_assignments")
        .select("student_id, trainer_id")
        .in("student_id", ids),
      supabase
        .from("student_access")
        .select("student_id, access_enabled, fee_status")
        .in("student_id", ids),
    ]);

  const accessByStudent = new Map<
    string,
    { accessEnabled: boolean; feeStatus: FeeStatus }
  >();
  for (const a of (access ?? []) as {
    student_id: string;
    access_enabled: boolean;
    fee_status: FeeStatus;
  }[]) {
    accessByStudent.set(a.student_id, {
      accessEnabled: a.access_enabled,
      feeStatus: a.fee_status,
    });
  }

  const trainerByStudent = new Map<string, string>();
  for (const l of (links ?? []) as {
    student_id: string;
    trainer_id: string | null;
  }[]) {
    if (l.trainer_id) trainerByStudent.set(l.student_id, l.trainer_id);
  }

  // Resolve trainer names in one lookup.
  const trainerIds = [...new Set([...trainerByStudent.values()])];
  const trainerName = new Map<string, string>();
  if (trainerIds.length > 0) {
    const { data: trainers } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("id", trainerIds);
    for (const t of (trainers ?? []) as {
      id: string;
      full_name: string | null;
      email: string;
    }[]) {
      trainerName.set(t.id, t.full_name || t.email);
    }
  }

  return ((profiles ?? []) as {
    id: string;
    full_name: string | null;
    email: string;
    avatar_url: string | null;
    created_at: string;
  }[]).map((p) => {
    const trainerId = trainerByStudent.get(p.id) ?? null;
    const acc = accessByStudent.get(p.id) ?? DEFAULT_ACCESS;
    return {
      id: p.id,
      name: p.full_name || p.email,
      email: p.email,
      avatarUrl: p.avatar_url,
      joinedAt: formatDate(p.created_at),
      joinedAtIso: p.created_at,
      trainerId,
      trainerName: trainerId ? (trainerName.get(trainerId) ?? null) : null,
      accessEnabled: acc.accessEnabled,
      feeStatus: acc.feeStatus,
    };
  });
}

/**
 * A single student by id — same shape as a roster row. Returns null when the id
 * doesn't belong to a profile that holds the 'student' role (so admins can't
 * open a trainer or a stranger through this route).
 */
export async function getStudent(id: string): Promise<StudentRow | null> {
  const supabase = await createClient();

  // Confirm this account actually holds the 'student' role.
  const { data: role } = await supabase
    .from("user_role_assignments")
    .select("user_id, user_roles!inner(name)")
    .eq("user_id", id)
    .eq("user_roles.name", "student")
    .maybeSingle();
  if (!role) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, email, avatar_url, created_at")
    .eq("id", id)
    .maybeSingle();
  if (!profile) return null;

  const p = profile as {
    id: string;
    full_name: string | null;
    email: string;
    avatar_url: string | null;
    created_at: string;
  };

  const [{ data: link }, { data: accessRow }] = await Promise.all([
    supabase
      .from("student_trainer_assignments")
      .select("trainer_id")
      .eq("student_id", id)
      .maybeSingle(),
    supabase
      .from("student_access")
      .select("access_enabled, fee_status")
      .eq("student_id", id)
      .maybeSingle(),
  ]);
  const trainerId = (link as { trainer_id: string | null } | null)?.trainer_id ?? null;
  const acc = accessRow as {
    access_enabled: boolean;
    fee_status: FeeStatus;
  } | null;

  let trainerNameValue: string | null = null;
  if (trainerId) {
    const { data: trainer } = await supabase
      .from("profiles")
      .select("full_name, email")
      .eq("id", trainerId)
      .maybeSingle();
    const t = trainer as { full_name: string | null; email: string } | null;
    trainerNameValue = t ? t.full_name || t.email : null;
  }

  return {
    id: p.id,
    name: p.full_name || p.email,
    email: p.email,
    avatarUrl: p.avatar_url,
    joinedAt: formatDate(p.created_at),
    joinedAtIso: p.created_at,
    trainerId,
    trainerName: trainerNameValue,
    accessEnabled: acc ? acc.access_enabled : DEFAULT_ACCESS.accessEnabled,
    feeStatus: acc ? acc.fee_status : DEFAULT_ACCESS.feeStatus,
  };
}
