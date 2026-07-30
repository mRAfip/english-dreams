import { createClient } from "@/lib/supabase/server";

// The trainer directory — every user holding the 'trainer' role, read from the
// profiles table joined to the role relation. Server-only.

export type TrainerRow = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  /** Preformatted join date, e.g. "08 Jan 2026". */
  joinedAt: string;
  joinedAtIso: string;
};

function formatDate(iso: string): string {
  // Deterministic server-side formatting (no locale drift into the client).
  const d = new Date(iso);
  const day = String(d.getUTCDate()).padStart(2, "0");
  const month = [
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
  ][d.getUTCMonth()];
  return `${day} ${month} ${d.getUTCFullYear()}`;
}

/** All trainers, newest first. */
export async function getTrainers(): Promise<TrainerRow[]> {
  const supabase = await createClient();

  const { data: assigns } = await supabase
    .from("user_role_assignments")
    .select("user_id, user_roles!inner(name)")
    .eq("user_roles.name", "trainer");

  const ids = ((assigns ?? []) as { user_id: string }[]).map((a) => a.user_id);
  if (ids.length === 0) return [];

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, email, avatar_url, created_at")
    .in("id", ids)
    .order("created_at", { ascending: false });

  return ((profiles ?? []) as {
    id: string;
    full_name: string | null;
    email: string;
    avatar_url: string | null;
    created_at: string;
  }[]).map((p) => ({
    id: p.id,
    name: p.full_name || p.email,
    email: p.email,
    avatarUrl: p.avatar_url,
    joinedAt: formatDate(p.created_at),
    joinedAtIso: p.created_at,
  }));
}

export type TrainerDetail = TrainerRow & {
  /** How many students are currently assigned to this trainer. */
  studentCount: number;
};

/**
 * A single trainer by id, with their assigned-student count. Returns null when
 * the id doesn't belong to a profile that holds the 'trainer' role.
 */
export async function getTrainer(id: string): Promise<TrainerDetail | null> {
  const supabase = await createClient();

  // Confirm this account actually holds the 'trainer' role.
  const { data: role } = await supabase
    .from("user_role_assignments")
    .select("user_id, user_roles!inner(name)")
    .eq("user_id", id)
    .eq("user_roles.name", "trainer")
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

  const { count } = await supabase
    .from("student_trainer_assignments")
    .select("student_id", { count: "exact", head: true })
    .eq("trainer_id", id);

  return {
    id: p.id,
    name: p.full_name || p.email,
    email: p.email,
    avatarUrl: p.avatar_url,
    joinedAt: formatDate(p.created_at),
    joinedAtIso: p.created_at,
    studentCount: count ?? 0,
  };
}
