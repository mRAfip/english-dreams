import { createAdminClient } from "@/lib/supabase/admin";
import type { Role } from "@/types/role";

// Participant hydration for the inbox, via the service-role client.
//
// Why service-role: profiles / user_role_assignments RLS only let a user read
// their OWN row (or an admin read all). A trainer or student therefore can't
// read the name/role of the person they're chatting with through their own
// client — it would resolve to "Unknown". These reads are safe to run with the
// service role because callers only ever pass ids the viewer is allowed to see
// (their conversation partners, or contacts the permission matrix already
// approved). Server-only.

export type ParticipantInfo = {
  name: string;
  email: string;
  avatarUrl: string | null;
  role: Role;
};

const PRECEDENCE: Role[] = ["admin", "trainer", "student"];

/** Best (highest-precedence) role for each of `ids`. */
export async function rolesForIds(ids: string[]): Promise<Map<string, Role>> {
  const map = new Map<string, Role>();
  if (ids.length === 0) return map;
  const admin = createAdminClient();
  const { data } = await admin
    .from("user_role_assignments")
    .select("user_id, user_roles!inner(name)")
    .in("user_id", ids);

  for (const row of (data ?? []) as {
    user_id: string;
    user_roles: { name: string } | { name: string }[] | null;
  }[]) {
    const joined = row.user_roles;
    const names = joined
      ? Array.isArray(joined)
        ? joined.map((r) => r.name)
        : [joined.name]
      : [];
    const best = PRECEDENCE.find((r) => names.includes(r));
    if (best) {
      const existing = map.get(row.user_id);
      if (!existing || PRECEDENCE.indexOf(best) < PRECEDENCE.indexOf(existing)) {
        map.set(row.user_id, best);
      }
    }
  }
  return map;
}

/** All user ids holding a given role. */
export async function userIdsWithRole(role: Role): Promise<string[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("user_role_assignments")
    .select("user_id, user_roles!inner(name)")
    .eq("user_roles.name", role);
  return ((data ?? []) as { user_id: string }[]).map((r) => r.user_id);
}

/** Name/email/avatar/role for each of `ids`, in one pair of queries. */
export async function participantInfo(
  ids: string[],
): Promise<Map<string, ParticipantInfo>> {
  const out = new Map<string, ParticipantInfo>();
  if (ids.length === 0) return out;

  const admin = createAdminClient();
  const [{ data: profiles }, roles] = await Promise.all([
    admin
      .from("profiles")
      .select("id, full_name, email, avatar_url")
      .in("id", ids),
    rolesForIds(ids),
  ]);

  for (const p of (profiles ?? []) as {
    id: string;
    full_name: string | null;
    email: string;
    avatar_url: string | null;
  }[]) {
    out.set(p.id, {
      name: p.full_name || p.email || "Unknown",
      email: p.email,
      avatarUrl: p.avatar_url,
      role: roles.get(p.id) ?? "student",
    });
  }
  return out;
}
