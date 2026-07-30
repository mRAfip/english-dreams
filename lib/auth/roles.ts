import type { SupabaseClient } from "@supabase/supabase-js";
import { ROLES, isRole, type Role } from "@/types/role";

/**
 * Where each role lands after signing in. Keyed by role *name*, never by the
 * `user_roles.id` UUID — those are generated per-project by gen_random_uuid(),
 * so they differ between our project and the client's.
 */
export const ROLE_HOME: Record<Role, string> = {
  admin: "/admin",
  trainer: "/trainer",
  student: "/student",
};

export const ROLE_LABEL: Record<Role, string> = {
  admin: "Admin",
  trainer: "Trainer",
  student: "Student",
};

/**
 * Route prefixes owned by each role. Used to reject cross-role access, e.g. a
 * student poking at /admin/students.
 */
export const ROLE_PREFIX: Record<Role, string> = {
  admin: "/admin",
  trainer: "/trainer",
  student: "/student",
};

/** Prefixes any signed-in user may visit, whatever their role. */
export const SHARED_PREFIXES = ["/inbox", "/profile"] as const;

/**
 * Precedence when a user somehow holds more than one role — the relation table
 * allows it (composite PK on user_id + role_id), so the app must be decisive.
 */
const ROLE_PRECEDENCE: readonly Role[] = ["admin", "trainer", "student"];

export function homeFor(role: Role): string {
  return ROLE_HOME[role];
}

/** The role that owns `pathname`, or null if it isn't a role-scoped route. */
export function roleForPath(pathname: string): Role | null {
  return (
    ROLES.find(
      (role) =>
        pathname === ROLE_PREFIX[role] ||
        pathname.startsWith(`${ROLE_PREFIX[role]}/`),
    ) ?? null
  );
}

export function isSharedPath(pathname: string): boolean {
  return SHARED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

type RoleAssignmentRow = {
  user_roles: { name: string } | { name: string }[] | null;
};

/**
 * Read a user's role from public.user_role_assignments, joined to user_roles.
 * Works with any Supabase client (browser or server) — RLS lets a user read
 * their own assignment rows.
 *
 * Returns null when the user has no assignment. Callers must treat that as
 * "no access" rather than falling back to a default role.
 */
export async function resolveRole(
  supabase: SupabaseClient,
  userId: string,
): Promise<Role | null> {
  const { data, error } = await supabase
    .from("user_role_assignments")
    .select("user_roles(name)")
    .eq("user_id", userId);

  if (error || !data) return null;

  const names = (data as RoleAssignmentRow[]).flatMap((row) => {
    const joined = row.user_roles;
    if (!joined) return [];
    return Array.isArray(joined) ? joined.map((r) => r.name) : [joined.name];
  });

  return ROLE_PRECEDENCE.find((role) => names.includes(role)) ?? null;
}

export { ROLES, isRole };
export type { Role };
