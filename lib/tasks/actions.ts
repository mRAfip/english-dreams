"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/guards";
import { buildSubmissionAudioKey } from "@/lib/r2/keys";
import { getUploadUrl } from "@/lib/r2/presign";
import { resolveDayId } from "@/lib/tasks/queries";
import type {
  AnswerInput,
  SubmissionStatus,
  TaskQuestionType,
} from "@/types/task";

// Write actions for the daily-task feature. Admin authoring re-checks admin;
// student submission + trainer review go through the user's own (RLS-enforced)
// client, so the policies are the real gate.

const CONTENT_PATH = "/admin/content-management";

async function assertAdmin() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") throw new Error("Not authorized");
  return user;
}

function revalidateDay(dayNumber: number) {
  revalidatePath(`${CONTENT_PATH}/${dayNumber}`);
  revalidatePath("/student/learning-path");
  revalidatePath(`/student/learning-path/${dayNumber}`);
  revalidatePath("/trainer/review-tasks");
}

// ---------------------------------------------------------------------------
// Admin — authoring questions
// ---------------------------------------------------------------------------

export async function addQuestion(input: {
  dayNumber: number;
  type: TaskQuestionType;
}): Promise<void> {
  await assertAdmin();
  const supabase = await createClient();
  const dayId = await resolveDayId(supabase, input.dayNumber);
  if (!dayId) throw new Error("Day not found");

  const { data: last } = await supabase
    .from("task_questions")
    .select("position")
    .eq("day_id", dayId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const position = ((last?.position as number | undefined) ?? 0) + 1;

  const { error } = await supabase
    .from("task_questions")
    .insert({ day_id: dayId, position, type: input.type, prompt: "" });
  if (error) throw new Error(error.message);
  // Mark the day's task as having content (draft) so it can be published.
  await supabase.from("content_days").update({ task_status: "draft" }).eq("id", dayId);
  revalidateDay(input.dayNumber);
}

export async function updateQuestion(input: {
  dayNumber: number;
  id: string;
  prompt: string;
  passage: string | null;
}): Promise<void> {
  await assertAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("task_questions")
    .update({ prompt: input.prompt, passage: input.passage })
    .eq("id", input.id);
  if (error) throw new Error(error.message);
  revalidateDay(input.dayNumber);
}

export async function deleteQuestion(input: {
  dayNumber: number;
  id: string;
}): Promise<void> {
  await assertAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("task_questions").delete().eq("id", input.id);
  if (error) throw new Error(error.message);
  revalidateDay(input.dayNumber);
}

export async function moveQuestion(input: {
  dayNumber: number;
  id: string;
  direction: "up" | "down";
}): Promise<void> {
  await assertAdmin();
  const supabase = await createClient();
  const dayId = await resolveDayId(supabase, input.dayNumber);
  if (!dayId) return;
  const { data } = await supabase
    .from("task_questions")
    .select("id, position")
    .eq("day_id", dayId)
    .order("position", { ascending: true });
  const list = (data ?? []) as { id: string; position: number }[];
  const idx = list.findIndex((q) => q.id === input.id);
  if (idx === -1) return;
  const swap = input.direction === "up" ? idx - 1 : idx + 1;
  if (swap < 0 || swap >= list.length) return;
  const a = list[idx];
  const b = list[swap];
  await supabase.from("task_questions").update({ position: -1 }).eq("id", a.id);
  await supabase.from("task_questions").update({ position: a.position }).eq("id", b.id);
  await supabase.from("task_questions").update({ position: b.position }).eq("id", a.id);
  revalidateDay(input.dayNumber);
}

export async function addFollowup(input: {
  dayNumber: number;
  questionId: string;
}): Promise<void> {
  await assertAdmin();
  const supabase = await createClient();
  const { data: last } = await supabase
    .from("task_question_followups")
    .select("position")
    .eq("question_id", input.questionId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const position = ((last?.position as number | undefined) ?? 0) + 1;
  const { error } = await supabase
    .from("task_question_followups")
    .insert({ question_id: input.questionId, position, prompt: "" });
  if (error) throw new Error(error.message);
  revalidateDay(input.dayNumber);
}

export async function updateFollowup(input: {
  dayNumber: number;
  id: string;
  prompt: string;
}): Promise<void> {
  await assertAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("task_question_followups")
    .update({ prompt: input.prompt })
    .eq("id", input.id);
  if (error) throw new Error(error.message);
  revalidateDay(input.dayNumber);
}

export async function deleteFollowup(input: {
  dayNumber: number;
  id: string;
}): Promise<void> {
  await assertAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("task_question_followups")
    .delete()
    .eq("id", input.id);
  if (error) throw new Error(error.message);
  revalidateDay(input.dayNumber);
}

// ---------------------------------------------------------------------------
// Student — submitting
// ---------------------------------------------------------------------------

export type UploadTicket = { key: string; uploadUrl: string };

/** Presigned PUT for a voice answer. */
export async function requestSubmissionAudioUploadUrl(input: {
  fileName: string;
}): Promise<UploadTicket> {
  const me = await getCurrentUser();
  if (!me) throw new Error("Not signed in.");
  const key = buildSubmissionAudioKey(me.id, input.fileName);
  return { key, uploadUrl: getUploadUrl(key) };
}

export type SubmitResult = { ok: true } | { ok: false; error: string };

/** Create or replace the student's submission for a day and mark it done. */
export async function submitTask(
  dayNumber: number,
  answers: AnswerInput[],
): Promise<SubmitResult> {
  const me = await getCurrentUser();
  if (!me) return { ok: false, error: "Not signed in." };

  const supabase = await createClient();
  const dayId = await resolveDayId(supabase, dayNumber);
  if (!dayId) return { ok: false, error: "Day not found." };

  const { data: sub, error: subError } = await supabase
    .from("task_submissions")
    .upsert(
      {
        day_id: dayId,
        student_id: me.id,
        status: "submitted" as SubmissionStatus,
        submitted_at: new Date().toISOString(),
      },
      { onConflict: "day_id,student_id" },
    )
    .select("id")
    .single();
  if (subError || !sub) {
    return { ok: false, error: subError?.message ?? "Could not submit." };
  }
  const submissionId = (sub as { id: string }).id;

  // Replace answers wholesale.
  await supabase.from("submission_answers").delete().eq("submission_id", submissionId);
  const rows = answers
    .filter((a) => a.text.trim() || a.audio)
    .map((a) => ({
      submission_id: submissionId,
      question_id: a.questionId,
      followup_id: a.followupId,
      answer_text: a.text.trim() || null,
      audio_key: a.audio?.key ?? null,
      audio_name: a.audio?.name ?? null,
      audio_type: a.audio?.contentType ?? null,
      audio_duration_min: a.audio?.durationMin ?? null,
    }));
  if (rows.length > 0) {
    const { error: ansError } = await supabase.from("submission_answers").insert(rows);
    if (ansError) return { ok: false, error: ansError.message };
  }

  // Submitting counts as completing the day's task.
  await supabase
    .from("student_day_progress")
    .upsert(
      { user_id: me.id, day_id: dayId, task_completed: true },
      { onConflict: "user_id,day_id" },
    );

  revalidateDay(dayNumber);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Trainer — review decision
// ---------------------------------------------------------------------------

export type ReviewResult = { ok: true } | { ok: false; error: string };

/** Approve or request a redo on a submission. */
export async function setSubmissionStatus(input: {
  submissionId: string;
  status: Exclude<SubmissionStatus, "submitted">;
}): Promise<ReviewResult> {
  const me = await getCurrentUser();
  if (!me) return { ok: false, error: "Not signed in." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("task_submissions")
    .update({ status: input.status })
    .eq("id", input.submissionId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/trainer/review-tasks");
  revalidatePath("/student/learning-path");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Review comments (realtime thread)
// ---------------------------------------------------------------------------

export type CommentResult =
  | { ok: true; id: string; createdAt: string }
  | { ok: false; error: string };

export async function postReviewComment(
  submissionId: string,
  body: string,
): Promise<CommentResult> {
  const me = await getCurrentUser();
  if (!me) return { ok: false, error: "Not signed in." };
  const trimmed = body.trim();
  if (!trimmed) return { ok: false, error: "Comment is empty." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("task_review_comments")
    .insert({ submission_id: submissionId, author_id: me.id, body: trimmed })
    .select("id, created_at")
    .single();
  if (error || !data) {
    return { ok: false, error: error?.message ?? "Could not send." };
  }
  return {
    ok: true,
    id: (data as { id: string }).id,
    createdAt: (data as { created_at: string }).created_at,
  };
}
