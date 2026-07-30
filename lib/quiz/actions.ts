"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/guards";
import type {
  ContentStatus,
} from "@/types/content";
import type {
  QuizAttemptResult,
  QuizDay,
  QuizKind,
  QuizQuestion,
  QuizReviewItem,
  StudentQuizQuestion,
} from "@/types/quiz";

// Quiz management. Admin authoring (save questions, publish) and the student
// taking flow (load questions without answers, submit → server-side marking).

const KIND_FOR: Record<QuizDay, QuizKind> = {
  saturday: "practice",
  sunday: "assessment",
};

async function assertAdmin() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") throw new Error("Not authorized");
  return user;
}

async function currentUserId(): Promise<string> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authorized");
  return user.id;
}

async function weekIdFor(
  supabase: SupabaseClient,
  weekNumber: number,
): Promise<string> {
  const { data } = await supabase
    .from("content_weeks")
    .select("id")
    .eq("week_number", weekNumber)
    .maybeSingle();
  if (!data) throw new Error(`Week ${weekNumber} not found`);
  return data.id as string;
}

// ---------------------------------------------------------------------------
// Admin authoring
// ---------------------------------------------------------------------------

/**
 * Save a weekend paper: upsert the quiz row and replace its questions. Creates
 * the quiz on first save. Keeps a published paper published; a paper with no
 * questions reverts to "empty".
 */
export async function saveQuiz(input: {
  weekNumber: number;
  day: QuizDay;
  title: string;
  questions: QuizQuestion[];
}): Promise<void> {
  await assertAdmin();
  const supabase = await createClient();
  const weekId = await weekIdFor(supabase, input.weekNumber);
  const kind = KIND_FOR[input.day];

  const { data: existing } = await supabase
    .from("content_quizzes")
    .select("id, status")
    .eq("week_id", weekId)
    .eq("day", input.day)
    .maybeSingle();

  const hasQuestions = input.questions.length > 0;
  const status: ContentStatus = !hasQuestions
    ? "empty"
    : existing?.status === "published"
      ? "published"
      : "draft";

  const { data: quiz, error } = await supabase
    .from("content_quizzes")
    .upsert(
      {
        ...(existing?.id ? { id: existing.id } : {}),
        week_id: weekId,
        day: input.day,
        kind,
        title: input.title.trim(),
        status,
      },
      { onConflict: "week_id,day" },
    )
    .select("id")
    .single();
  if (error || !quiz) throw new Error(`Failed to save quiz: ${error?.message}`);

  // Replace the question set wholesale — simplest correct approach for an edit.
  const { error: delError } = await supabase
    .from("content_quiz_questions")
    .delete()
    .eq("quiz_id", quiz.id);
  if (delError) throw new Error(`Failed to clear questions: ${delError.message}`);

  if (hasQuestions) {
    const rows = input.questions.map((q, i) => ({
      quiz_id: quiz.id,
      position: i,
      prompt: q.prompt.trim(),
      options: q.options.map((o) => o.trim()).filter((o) => o.length > 0),
      correct_index: q.correctIndex,
      explanation: q.explanation.trim(),
    }));
    const { error: insError } = await supabase
      .from("content_quiz_questions")
      .insert(rows);
    if (insError) throw new Error(`Failed to save questions: ${insError.message}`);
  }

  revalidatePath("/admin/content-management");
  revalidatePath(
    `/admin/content-management/quiz/${input.weekNumber}/${input.day}`,
  );
}

/** Publish / unpublish a weekend paper (only meaningful once it has questions). */
export async function setQuizPublished(input: {
  weekNumber: number;
  day: QuizDay;
  publish: boolean;
}): Promise<void> {
  await assertAdmin();
  const supabase = await createClient();
  const weekId = await weekIdFor(supabase, input.weekNumber);

  const { error } = await supabase
    .from("content_quizzes")
    .update({ status: input.publish ? "published" : "draft" })
    .eq("week_id", weekId)
    .eq("day", input.day);
  if (error) throw new Error(`Failed to update quiz: ${error.message}`);

  revalidatePath("/admin/content-management");
  revalidatePath(
    `/admin/content-management/quiz/${input.weekNumber}/${input.day}`,
  );
}

// ---------------------------------------------------------------------------
// Student taking
// ---------------------------------------------------------------------------

type QuestionRow = {
  id: string;
  position: number;
  prompt: string;
  options: string[];
  correct_index: number;
  explanation: string;
};

/** Load a paper's questions for sitting — answers withheld until submission. */
export async function startQuiz(
  quizId: string,
): Promise<StudentQuizQuestion[]> {
  await currentUserId();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("content_quiz_questions")
    .select("id, position, prompt, options")
    .eq("quiz_id", quizId)
    .order("position", { ascending: true });
  if (error) throw new Error(`Failed to load quiz: ${error.message}`);

  return ((data ?? []) as Omit<QuestionRow, "correct_index" | "explanation">[]).map(
    (q) => ({
      id: q.id,
      prompt: q.prompt,
      options: Array.isArray(q.options) ? q.options : [],
    }),
  );
}

/**
 * Mark a submitted paper server-side and store the attempt. `answers` is the
 * chosen option index per question, in the same order startQuiz returned them.
 * Returns the score plus a per-question review (the answer key, revealed now).
 */
export async function submitQuizAttempt(
  quizId: string,
  answers: (number | null)[],
): Promise<QuizAttemptResult> {
  const userId = await currentUserId();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("content_quiz_questions")
    .select("id, position, prompt, options, correct_index, explanation")
    .eq("quiz_id", quizId)
    .order("position", { ascending: true });
  if (error) throw new Error(`Failed to mark quiz: ${error.message}`);

  const questions = (data ?? []) as QuestionRow[];
  const total = questions.length;

  const review: QuizReviewItem[] = questions.map((q, i) => ({
    questionId: q.id,
    prompt: q.prompt,
    options: Array.isArray(q.options) ? q.options : [],
    chosenIndex: answers[i] ?? null,
    correctIndex: q.correct_index,
    explanation: q.explanation,
  }));

  const correctCount = review.filter(
    (r) => r.chosenIndex !== null && r.chosenIndex === r.correctIndex,
  ).length;
  const score = total === 0 ? 0 : Math.round((correctCount / total) * 100);

  const { error: attemptError } = await supabase
    .from("student_quiz_attempts")
    .upsert(
      {
        user_id: userId,
        quiz_id: quizId,
        score,
        correct_count: correctCount,
        total,
        answers: answers.map((a) => (a === null ? -1 : a)),
      },
      { onConflict: "user_id,quiz_id" },
    );
  if (attemptError) {
    throw new Error(`Failed to record attempt: ${attemptError.message}`);
  }

  revalidatePath("/student/quizzes");
  revalidatePath("/student");

  return { score, correctCount, total, review };
}
