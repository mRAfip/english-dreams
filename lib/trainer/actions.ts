"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth/guards";

// Admin actions for managing trainers. Creating an account uses the Auth Admin
// API (service role), so these run server-side and re-check the caller is admin.

async function assertAdmin() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") throw new Error("Not authorized");
}

export type CreateTrainerResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Provision a trainer: create the auth user (email + password, confirmed so they
 * can sign in immediately), ensure a profile row, and link them to the 'trainer'
 * role via user_role_assignments.
 */
export async function createTrainer(input: {
  name: string;
  email: string;
  password: string;
}): Promise<CreateTrainerResult> {
  await assertAdmin();

  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  const password = input.password;

  if (!name) return { ok: false, error: "Name is required." };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
    return { ok: false, error: "Enter a valid email." };
  if (password.length < 6)
    return { ok: false, error: "Password must be at least 6 characters." };

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

  // 2. Ensure the profile row (the on_auth_user_created trigger usually makes
  //    it, but upsert so we never race a missing row before the role link).
  const { error: profileError } = await admin
    .from("profiles")
    .upsert({ id: userId, email, full_name: name }, { onConflict: "id" });
  if (profileError) {
    return { ok: false, error: `Profile: ${profileError.message}` };
  }

  // 3. Link to the 'trainer' role.
  const { data: role } = await admin
    .from("user_roles")
    .select("id")
    .eq("name", "trainer")
    .single();
  if (!role) return { ok: false, error: "The 'trainer' role is missing." };

  const { error: roleError } = await admin
    .from("user_role_assignments")
    .upsert(
      { user_id: userId, role_id: role.id },
      { onConflict: "user_id,role_id" },
    );
  if (roleError) return { ok: false, error: `Role: ${roleError.message}` };

  revalidatePath("/admin/trainers");
  return { ok: true };
}

export type UpdateTrainerResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Edit an existing trainer: name, email, and an optional password reset. Email
 * and password go through the Auth Admin API; the profile row is kept in sync.
 */
export async function updateTrainer(input: {
  id: string;
  name: string;
  email: string;
  password?: string;
}): Promise<UpdateTrainerResult> {
  await assertAdmin();

  const id = input.id;
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  const password = input.password?.trim() ?? "";

  if (!id) return { ok: false, error: "Missing trainer id." };
  if (!name) return { ok: false, error: "Name is required." };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
    return { ok: false, error: "Enter a valid email." };
  if (password && password.length < 6)
    return { ok: false, error: "Password must be at least 6 characters." };

  const admin = createAdminClient();

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
      error: /already/i.test(msg) ? "That email is already registered." : msg,
    };
  }

  const { error: profileError } = await admin
    .from("profiles")
    .update({ email, full_name: name })
    .eq("id", id);
  if (profileError) {
    return { ok: false, error: `Profile: ${profileError.message}` };
  }

  revalidatePath("/admin/trainers");
  revalidatePath(`/admin/trainers/${id}`);
  return { ok: true };
}

export type DeleteTrainerResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Remove a trainer. Deleting the auth user cascades to their profile and role
 * assignment; any students linked to them have their trainer_id set to null
 * (student_trainer_assignments.trainer_id is `on delete set null`), so those
 * students simply become unassigned rather than blocking the delete.
 */
export async function deleteTrainer(input: {
  id: string;
}): Promise<DeleteTrainerResult> {
  await assertAdmin();
  if (!input.id) return { ok: false, error: "Missing trainer id." };

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(input.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/trainers");
  return { ok: true };
}
