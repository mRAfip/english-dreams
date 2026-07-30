import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { homeFor, resolveRole, type Role } from "@/lib/auth/roles";

export type CurrentUser = {
  id: string;
  email: string;
  role: Role;
  fullName: string | null;
  avatarUrl: string | null;
  /**
   * Whether the account may use the app. Only students can be suspended (by an
   * admin, via student_access.access_enabled); every other role is always true,
   * as is a student with no access row.
   */
  accessEnabled: boolean;
};

/**
 * Resolve the signed-in user plus their role and profile.
 * Returns null when there is no session, or when the account has no row in
 * user_role_assignments (an account an admin created but never assigned).
 *
 * cache()d so the nested (dashboard) + section layouts share one lookup per
 * request instead of each paying for the round trip.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const role = await resolveRole(supabase, user.id);
  if (!role) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  // Only students carry an access flag. Missing row -> enabled (opt-in table),
  // so we don't lock out students who predate the feature.
  let accessEnabled = true;
  if (role === "student") {
    const { data: access } = await supabase
      .from("student_access")
      .select("access_enabled")
      .eq("student_id", user.id)
      .maybeSingle();
    accessEnabled = (access as { access_enabled: boolean } | null)?.access_enabled ?? true;
  }

  return {
    id: user.id,
    email: user.email ?? "",
    role,
    fullName: profile?.full_name ?? null,
    avatarUrl: profile?.avatar_url ?? null,
    accessEnabled,
  };
});

/**
 * Section guard for the role layouts. No session -> /login. Wrong role -> that
 * user's own dashboard (not a 403, so a trainer following an /admin link just
 * lands somewhere sensible).
 */
export async function requireRole(allowed: Role | Role[]): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const roles = Array.isArray(allowed) ? allowed : [allowed];
  if (!roles.includes(user.role)) redirect(homeFor(user.role));

  return user;
}

/** Any signed-in, role-assigned user — for the shared /inbox and /profile. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
