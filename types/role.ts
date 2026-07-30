// Role — the three roles seeded in public.user_roles.
// The DB is the source of truth; this union mirrors its `name` check constraint.

export const ROLES = ["admin", "trainer", "student"] as const;

export type Role = (typeof ROLES)[number];

export function isRole(value: unknown): value is Role {
  return (
    typeof value === "string" && (ROLES as readonly string[]).includes(value)
  );
}
