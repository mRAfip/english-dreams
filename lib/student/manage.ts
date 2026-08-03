"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth/guards";

// Admin actions for managing students. Creating an account uses the Auth Admin
// API (service role), so these run server-side and re-check the caller is admin.

async function assertAdmin(): Promise<string> {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") throw new Error("Not authorized");
  return user.id;
}

export type CreateStudentResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Provision a student: create the auth user (confirmed), ensure a profile, link
 * them to the 'student' role, record the trainer assignment if one is chosen,
 * and seed their access row with the course they'll follow.
 *
 * The course is what decides which curriculum they see, so it is required at
 * creation — a student with no course lands on an empty learning path, which
 * looks like a broken account rather than a pending decision.
 */
export async function createStudent(input: {
  name: string;
  email: string;
  password: string;
  trainerId?: string | null;
  /** The course this student will follow. Required — see the check below. */
  courseId?: string | null;
}): Promise<CreateStudentResult> {
  const adminId = await assertAdmin();

  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  const password = input.password;

  if (!name) return { ok: false, error: "Name is required." };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
    return { ok: false, error: "Enter a valid email." };
  if (password.length < 6)
    return { ok: false, error: "Password must be at least 6 characters." };
  if (!input.courseId)
    return { ok: false, error: "Choose the course this student will follow." };

  const admin = createAdminClient();

  // 1. Create the auth user (already confirmed).
  const { data: created, error: createError } =
    await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: name },
    });
  if (createError || !created.user) {
    const msg = createError?.message ?? "Could not create the account.";
    return {
      ok: false,
      error: /already/i.test(msg) ? "That email is already registered." : msg,
    };
  }
  const userId = created.user.id;

  // 2. Ensure the profile row.
  const { error: profileError } = await admin
    .from("profiles")
    .upsert({ id: userId, email, full_name: name }, { onConflict: "id" });
  if (profileError) {
    return { ok: false, error: `Profile: ${profileError.message}` };
  }

  // 3. Link to the 'student' role.
  const { data: role } = await admin
    .from("user_roles")
    .select("id")
    .eq("name", "student")
    .single();
  if (!role) return { ok: false, error: "The 'student' role is missing." };

  const { error: roleError } = await admin
    .from("user_role_assignments")
    .upsert(
      { user_id: userId, role_id: role.id },
      { onConflict: "user_id,role_id" },
    );
  if (roleError) return { ok: false, error: `Role: ${roleError.message}` };

  // 4. Optional trainer assignment.
  if (input.trainerId) {
    const { error: linkError } = await admin
      .from("student_trainer_assignments")
      .upsert(
        {
          student_id: userId,
          trainer_id: input.trainerId,
          assigned_by: adminId,
        },
        { onConflict: "student_id" },
      );
    if (linkError) {
      return { ok: false, error: `Trainer link: ${linkError.message}` };
    }
  }

  // 5. Seed the access row so every student has an explicit access record from
  //    day one (access on, fee unpaid). The login access-check reads this row,
  //    and so does every course-scoped read — course_id lives here.
  const { error: accessError } = await admin
    .from("student_access")
    .upsert(
      {
        student_id: userId,
        access_enabled: true,
        fee_status: "unpaid",
        course_id: input.courseId,
        updated_by: adminId,
      },
      { onConflict: "student_id" },
    );
  if (accessError) {
    return { ok: false, error: `Access: ${accessError.message}` };
  }

  revalidatePath("/admin/students");
  return { ok: true };
}

export type UpdateStudentResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Edit an existing student: name, email, an optional password reset, the
 * trainer they're assigned to, and the course they follow. Email and password
 * changes go through the Auth Admin API; the trainer link is upserted (or
 * cleared when set to unassigned).
 *
 * MOVING A STUDENT BETWEEN COURSES restarts them at day 1 of the new course.
 * Their old progress rows are kept, not deleted — they belong to the old
 * course's days and are simply not counted against the new one, so moving a
 * student back restores their history intact.
 */
export async function updateStudent(input: {
  id: string;
  name: string;
  email: string;
  password?: string;
  trainerId?: string | null;
  /** Pass to move the student to a different course. Omit to leave it alone. */
  courseId?: string | null;
}): Promise<UpdateStudentResult> {
  const adminId = await assertAdmin();

  const id = input.id;
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  const password = input.password?.trim() ?? "";

  if (!id) return { ok: false, error: "Missing student id." };
  if (!name) return { ok: false, error: "Name is required." };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
    return { ok: false, error: "Enter a valid email." };
  if (password && password.length < 6)
    return { ok: false, error: "Password must be at least 6 characters." };

  const admin = createAdminClient();

  // 1. Update the auth user (email + name metadata, and password when given).
  const attrs: {
    email: string;
    user_metadata: { full_name: string };
    password?: string;
  } = { email, user_metadata: { full_name: name } };
  if (password) attrs.password = password;

  const { error: authError } = await admin.auth.admin.updateUserById(id, attrs);
  if (authError) {
    const msg = authError.message;
    return {
      ok: false,
      error: /already/i.test(msg)
        ? "That email is already registered."
        : msg,
    };
  }

  // 2. Keep the profile row in sync.
  const { error: profileError } = await admin
    .from("profiles")
    .update({ email, full_name: name })
    .eq("id", id);
  if (profileError) {
    return { ok: false, error: `Profile: ${profileError.message}` };
  }

  // 3. Course assignment, when the caller passed one.
  if (input.courseId !== undefined) {
    const { error: courseError } = await admin
      .from("student_access")
      .upsert(
        { student_id: id, course_id: input.courseId, updated_by: adminId },
        { onConflict: "student_id" },
      );
    if (courseError) {
      return { ok: false, error: `Course: ${courseError.message}` };
    }
  }

  // 4. Reconcile the trainer link — upsert when chosen, delete when cleared.
  if (input.trainerId) {
    const { error: linkError } = await admin
      .from("student_trainer_assignments")
      .upsert(
        {
          student_id: id,
          trainer_id: input.trainerId,
          assigned_by: adminId,
        },
        { onConflict: "student_id" },
      );
    if (linkError) {
      return { ok: false, error: `Trainer link: ${linkError.message}` };
    }
  } else {
    const { error: unlinkError } = await admin
      .from("student_trainer_assignments")
      .delete()
      .eq("student_id", id);
    if (unlinkError) {
      return { ok: false, error: `Trainer link: ${unlinkError.message}` };
    }
  }

  revalidatePath("/admin/students");
  revalidatePath(`/admin/students/${id}`);
  return { ok: true };
}

export type DeleteStudentResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Remove a student entirely. Deleting the auth user cascades to their profile,
 * role assignment and trainer link (all FKs are `on delete cascade`).
 */
export async function deleteStudent(input: {
  id: string;
}): Promise<DeleteStudentResult> {
  await assertAdmin();
  if (!input.id) return { ok: false, error: "Missing student id." };

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(input.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/students");
  return { ok: true };
}

export type FeeStatus = "paid" | "unpaid" | "waived";

export type SetStudentAccessResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Set a student's access switch and fee status. `access_enabled: false`
 * suspends them — the student layout redirects a suspended student to
 * /suspended on their next request. Upserts one row per student.
 */
export async function setStudentAccess(input: {
  id: string;
  accessEnabled: boolean;
  feeStatus: FeeStatus;
  note?: string | null;
}): Promise<SetStudentAccessResult> {
  const adminId = await assertAdmin();

  if (!input.id) return { ok: false, error: "Missing student id." };
  if (!["paid", "unpaid", "waived"].includes(input.feeStatus))
    return { ok: false, error: "Invalid fee status." };

  const admin = createAdminClient();
  const { error } = await admin.from("student_access").upsert(
    {
      student_id: input.id,
      access_enabled: input.accessEnabled,
      fee_status: input.feeStatus,
      note: input.note?.trim() || null,
      updated_by: adminId,
    },
    { onConflict: "student_id" },
  );
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/students");
  revalidatePath(`/admin/students/${input.id}`);
  return { ok: true };
}

export type AdminResetUserPasswordResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Reset any user's password (student or trainer) by their user ID.
 * Restricted to administrators only.
 */
export async function adminResetUserPassword(input: {
  userId: string;
  password?: string;
}): Promise<AdminResetUserPasswordResult> {
  await assertAdmin();

  const password = input.password?.trim() ?? "";
  if (!password) {
    return { ok: false, error: "Password cannot be empty." };
  }
  if (password.length < 6) {
    return { ok: false, error: "Password must be at least 6 characters." };
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(input.userId, {
    password,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}
