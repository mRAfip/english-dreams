"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/guards";
import { courseIdForStudent } from "@/lib/student/course";
import { TEACHING_DAYS_PER_WEEK } from "@/types/content";

// Server Actions a student calls as they move through a day: mark the class
// watched, the notes downloaded, the task done. Each upserts the student's own
// row in student_day_progress (RLS guarantees they can only touch their own).
//
// A day number is only meaningful inside a course, and these actions are called
// from the client with a plain number — so every one of them resolves the
// caller's OWN course server-side and looks the day up inside it. A student can
// therefore never record progress against another course's day, whatever they
// post.

/** Signed-in user id, or throw. Any authenticated user tracks their own row. */
async function currentUserId(): Promise<string> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authorized");
  return user.id;
}

/** The content_days.id for a teaching day of the student's own course. */
async function resolveDayId(
  supabase: SupabaseClient,
  userId: string,
  dayNumber: number,
): Promise<string> {
  const courseId = await courseIdForStudent(userId);
  if (!courseId) throw new Error("No course assigned");

  const weekNumber = Math.floor((dayNumber - 1) / TEACHING_DAYS_PER_WEEK) + 1;
  const weekday = ((dayNumber - 1) % TEACHING_DAYS_PER_WEEK) + 1;

  const { data: week } = await supabase
    .from("content_weeks")
    .select("id")
    .eq("course_id", courseId)
    .eq("week_number", weekNumber)
    .maybeSingle();
  if (!week) throw new Error(`Week ${weekNumber} not found`);

  const { data: day } = await supabase
    .from("content_days")
    .select("id")
    .eq("week_id", week.id)
    .eq("weekday", weekday)
    .maybeSingle();
  if (!day) throw new Error(`Day ${dayNumber} not found`);

  return day.id as string;
}

/** Upsert one progress flag for the current student, leaving the others intact. */
async function setFlag(
  dayNumber: number,
  patch: Partial<{
    video_watched: boolean;
    notes_downloaded: boolean;
    task_completed: boolean;
  }>,
): Promise<void> {
  const userId = await currentUserId();
  const supabase = await createClient();
  const dayId = await resolveDayId(supabase, userId, dayNumber);

  const { error } = await supabase
    .from("student_day_progress")
    .upsert(
      { user_id: userId, day_id: dayId, ...patch },
      { onConflict: "user_id,day_id" },
    );
  if (error) throw new Error(`Failed to save progress: ${error.message}`);

  revalidatePath("/student");
  revalidatePath("/student/learning-path");
  revalidatePath(`/student/learning-path/${dayNumber}`);
}

export async function markVideoWatched(dayNumber: number): Promise<void> {
  await setFlag(dayNumber, { video_watched: true });
}

export async function markNotesDownloaded(dayNumber: number): Promise<void> {
  await setFlag(dayNumber, { notes_downloaded: true });
}

/**
 * Record that the student has played one video part. Adds it to the watched set
 * and flips the day-level `video_watched` flag once EVERY published part is in.
 */
export async function markVideoPartWatched(
  dayNumber: number,
  partId: string,
): Promise<void> {
  const userId = await currentUserId();
  const supabase = await createClient();
  const dayId = await resolveDayId(supabase, userId, dayNumber);

  const { data: existing } = await supabase
    .from("student_day_progress")
    .select("watched_video_parts")
    .eq("user_id", userId)
    .eq("day_id", dayId)
    .maybeSingle();
  const current =
    ((existing as { watched_video_parts: string[] | null } | null)
      ?.watched_video_parts) ?? [];
  const watched = current.includes(partId) ? current : [...current, partId];

  const { data: parts } = await supabase
    .from("content_day_videos")
    .select("id")
    .eq("day_id", dayId)
    .eq("status", "published");
  const publishedIds = ((parts ?? []) as { id: string }[]).map((p) => p.id);
  const allWatched =
    publishedIds.length > 0 && publishedIds.every((id) => watched.includes(id));

  const { error } = await supabase.from("student_day_progress").upsert(
    {
      user_id: userId,
      day_id: dayId,
      watched_video_parts: watched,
      video_watched: allWatched,
    },
    { onConflict: "user_id,day_id" },
  );
  if (error) throw new Error(`Failed to save progress: ${error.message}`);

  revalidatePath("/student");
  revalidatePath("/student/learning-path");
}

export async function setTaskCompleted(
  dayNumber: number,
  completed: boolean,
): Promise<void> {
  await setFlag(dayNumber, { task_completed: completed });
}
