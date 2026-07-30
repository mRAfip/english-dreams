import { createAdminClient } from "@/lib/supabase/admin";
import type { Role } from "@/lib/auth/roles";
import type { CurrentUser } from "@/lib/auth/guards";
import type { Participant } from "@/types/message";
import {
  participantInfo,
  rolesForIds,
  userIdsWithRole,
} from "@/lib/inbox/participants";

// Who may message whom — the single source of truth for the inbox permission
// matrix. Server-only. Uses the service-role client for role/assignment reads
// (a non-admin can't read another user's role/profile through their own client),
// but every rule is enforced here in code:
//
//   admin    ↔ everyone (trainers, students, other admins)
//   trainer  ↔ admins + their own assigned students
//   student  ↔ admins + their own trainer

/** True if `me` is allowed to hold a conversation with `otherId`. */
export async function canMessage(
  me: CurrentUser,
  otherId: string,
): Promise<boolean> {
  if (!otherId || otherId === me.id) return false;

  const roles = await rolesForIds([otherId]);
  const otherRole = roles.get(otherId);
  if (!otherRole) return false;

  // An admin on either side can always talk.
  if (me.role === "admin" || otherRole === "admin") return true;

  if (me.role === "trainer" && otherRole === "student") {
    return isAssigned(otherId, me.id);
  }
  if (me.role === "student" && otherRole === "trainer") {
    return isAssigned(me.id, otherId);
  }

  // trainer↔trainer and student↔student are not allowed.
  return false;
}

/** Is `studentId` assigned to `trainerId`? */
async function isAssigned(studentId: string, trainerId: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("student_trainer_assignments")
    .select("student_id")
    .eq("student_id", studentId)
    .eq("trainer_id", trainerId)
    .maybeSingle();
  return Boolean(data);
}

/** The ids (and role) of everyone `me` is allowed to message. */
export async function allowedContactIds(
  me: CurrentUser,
): Promise<{ id: string; role: Role }[]> {
  const admin = createAdminClient();
  const adminIds = await userIdsWithRole("admin");
  const entries: { id: string; role: Role }[] = [];

  if (me.role === "admin") {
    const [trainerIds, studentIds] = await Promise.all([
      userIdsWithRole("trainer"),
      userIdsWithRole("student"),
    ]);
    for (const id of trainerIds) entries.push({ id, role: "trainer" });
    for (const id of studentIds) entries.push({ id, role: "student" });
    for (const id of adminIds) entries.push({ id, role: "admin" });
  } else if (me.role === "trainer") {
    for (const id of adminIds) entries.push({ id, role: "admin" });
    const { data: links } = await admin
      .from("student_trainer_assignments")
      .select("student_id")
      .eq("trainer_id", me.id);
    for (const l of (links ?? []) as { student_id: string }[]) {
      entries.push({ id: l.student_id, role: "student" });
    }
  } else {
    for (const id of adminIds) entries.push({ id, role: "admin" });
    const { data: link } = await admin
      .from("student_trainer_assignments")
      .select("trainer_id")
      .eq("student_id", me.id)
      .maybeSingle();
    const trainerId = (link as { trainer_id: string | null } | null)?.trainer_id;
    if (trainerId) entries.push({ id: trainerId, role: "trainer" });
  }

  // Drop self and de-duplicate by id.
  const seen = new Set<string>([me.id]);
  return entries.filter((e) => {
    if (seen.has(e.id)) return false;
    seen.add(e.id);
    return true;
  });
}

/** Full Participant records for everyone `me` may message, name-sorted. */
export async function getContacts(me: CurrentUser): Promise<Participant[]> {
  const entries = await allowedContactIds(me);
  if (entries.length === 0) return [];

  const info = await participantInfo(entries.map((e) => e.id));
  return entries
    .map((e) => {
      const i = info.get(e.id);
      return {
        id: e.id,
        name: i?.name || i?.email || "Unknown",
        role: i?.role ?? e.role,
        avatarUrl: i?.avatarUrl ?? null,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}
