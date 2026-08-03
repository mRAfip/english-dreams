"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/guards";
import {
  buildAssetKey,
  buildVideoThumbnailKey,
  type AssetKind,
} from "@/lib/r2/keys";
import { getUploadUrl, deleteObject } from "@/lib/r2/presign";
import { TEACHING_DAYS_PER_WEEK, type ContentStatus } from "@/types/content";

// Server Actions backing /admin/content-management. Every action re-checks that
// the caller is an admin — Server Actions are reachable by direct POST, so the
// RLS policies are a backstop, not the only gate.
//
// Everything below the course level is COURSE-SCOPED: an action that touches a
// week or a day takes the course it belongs to, because week numbers and day
// numbers only identify a row once you know the course.

const CONTENT_PATH = "/admin/content-management";

/** The admin editor for one course. */
function coursePath(slug: string): string {
  return `${CONTENT_PATH}/${slug}`;
}

/** Throw unless the caller is a signed-in admin. Returns the admin's user. */
async function assertAdmin() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    throw new Error("Not authorized");
  }
  return user;
}

/** Resolve the week_number + intra-week weekday for a day number. */
function locate(dayNumber: number): { weekNumber: number; weekday: number } {
  return {
    weekNumber: Math.floor((dayNumber - 1) / TEACHING_DAYS_PER_WEEK) + 1,
    weekday: ((dayNumber - 1) % TEACHING_DAYS_PER_WEEK) + 1,
  };
}

/** A course's id from its slug, or throw. Slugs are what the admin URLs carry. */
async function resolveCourseId(
  supabase: SupabaseClient,
  courseSlug: string,
): Promise<string> {
  const { data } = await supabase
    .from("content_courses")
    .select("id")
    .eq("slug", courseSlug)
    .maybeSingle();
  if (!data) throw new Error(`Course "${courseSlug}" not found`);
  return data.id as string;
}

/** The content_weeks.id for a week of a course, or throw. */
async function resolveWeekId(
  supabase: SupabaseClient,
  courseSlug: string,
  weekNumber: number,
): Promise<string> {
  const courseId = await resolveCourseId(supabase, courseSlug);
  const { data } = await supabase
    .from("content_weeks")
    .select("id")
    .eq("course_id", courseId)
    .eq("week_number", weekNumber)
    .maybeSingle();
  if (!data) throw new Error(`Week ${weekNumber} not found`);
  return data.id as string;
}

/** The content_days.id for a teaching day of a course, or throw. */
async function resolveDayId(
  supabase: SupabaseClient,
  courseSlug: string,
  dayNumber: number,
): Promise<string> {
  const { weekNumber, weekday } = locate(dayNumber);
  const weekId = await resolveWeekId(supabase, courseSlug, weekNumber);

  const { data: day } = await supabase
    .from("content_days")
    .select("id")
    .eq("week_id", weekId)
    .eq("weekday", weekday)
    .maybeSingle();
  if (!day) throw new Error(`Day ${dayNumber} not found`);

  return day.id as string;
}

function revalidateDay(courseSlug: string, dayNumber: number) {
  revalidatePath(CONTENT_PATH);
  revalidatePath(coursePath(courseSlug));
  revalidatePath(`${coursePath(courseSlug)}/${dayNumber}`);
}

// ---------------------------------------------------------------------------
// Uploads (R2)
// ---------------------------------------------------------------------------

export type UploadTicket = {
  /** R2 object key the client should record after a successful PUT. */
  key: string;
  /** Presigned PUT URL — upload the file body here with fetch(PUT). */
  uploadUrl: string;
};

/**
 * Step 1 of an upload: mint an R2 object key + presigned PUT URL. The browser
 * uploads the file directly to R2, then calls saveAsset() to record it.
 */
export async function requestUploadUrl(input: {
  courseSlug: string;
  dayNumber: number;
  kind: AssetKind;
  fileName: string;
}): Promise<UploadTicket> {
  await assertAdmin();
  const key = buildAssetKey(
    input.courseSlug,
    input.dayNumber,
    input.kind,
    input.fileName,
  );
  return { key, uploadUrl: getUploadUrl(key) };
}

/**
 * Step 2 of an upload: record the object in the DB. Upserts the day's asset row
 * of this kind; if it replaces a different object, the old one is deleted from
 * R2. New assets land as "draft" so an admin publishes deliberately.
 */
export async function saveAsset(input: {
  courseSlug: string;
  dayNumber: number;
  kind: AssetKind;
  key: string;
  fileName: string;
  contentType?: string | null;
  sizeBytes?: number | null;
  durationMin?: number | null;
}): Promise<void> {
  const user = await assertAdmin();
  const supabase = await createClient();
  const dayId = await resolveDayId(supabase, input.courseSlug, input.dayNumber);

  const { data: existing } = await supabase
    .from("content_assets")
    .select("r2_key")
    .eq("day_id", dayId)
    .eq("kind", input.kind)
    .maybeSingle();

  const { error } = await supabase.from("content_assets").upsert(
    {
      day_id: dayId,
      kind: input.kind,
      r2_key: input.key,
      file_name: input.fileName,
      content_type: input.contentType ?? null,
      size_bytes: input.sizeBytes ?? null,
      duration_min: input.durationMin ?? null,
      status: "draft" as ContentStatus,
      uploaded_by: user.id,
    },
    { onConflict: "day_id,kind" },
  );
  if (error) throw new Error(`Failed to save asset: ${error.message}`);

  // Best-effort cleanup of the replaced object; the row already points elsewhere.
  const oldKey = existing?.r2_key as string | undefined;
  if (oldKey && oldKey !== input.key) {
    await deleteObject(oldKey).catch(() => {});
  }

  revalidateDay(input.courseSlug, input.dayNumber);
}

/** Remove a day's asset of a kind, from both the DB and R2. */
export async function deleteAsset(input: {
  courseSlug: string;
  dayNumber: number;
  kind: AssetKind;
}): Promise<void> {
  await assertAdmin();
  const supabase = await createClient();
  const dayId = await resolveDayId(supabase, input.courseSlug, input.dayNumber);

  const { data: row } = await supabase
    .from("content_assets")
    .select("r2_key")
    .eq("day_id", dayId)
    .eq("kind", input.kind)
    .maybeSingle();
  if (!row) return;

  const { error } = await supabase
    .from("content_assets")
    .delete()
    .eq("day_id", dayId)
    .eq("kind", input.kind);
  if (error) throw new Error(`Failed to delete asset: ${error.message}`);

  await deleteObject(row.r2_key as string).catch(() => {});
  revalidateDay(input.courseSlug, input.dayNumber);
}

/** Publish / unpublish a day's video or notes. */
export async function setAssetStatus(input: {
  courseSlug: string;
  dayNumber: number;
  kind: AssetKind;
  status: ContentStatus;
}): Promise<void> {
  await assertAdmin();
  const supabase = await createClient();
  const dayId = await resolveDayId(supabase, input.courseSlug, input.dayNumber);

  const { error } = await supabase
    .from("content_assets")
    .update({ status: input.status })
    .eq("day_id", dayId)
    .eq("kind", input.kind);
  if (error) throw new Error(`Failed to update status: ${error.message}`);

  revalidateDay(input.courseSlug, input.dayNumber);
}

/**
 * Publish (or unpublish) a whole day: flips its video, notes, and task between
 * "published" and "draft". Only slots that actually have content are touched —
 * empty slots stay "empty". Acts on saved content, so it runs immediately.
 */
export async function setDayPublished(input: {
  courseSlug: string;
  dayNumber: number;
  publish: boolean;
}): Promise<void> {
  await assertAdmin();
  const supabase = await createClient();
  const dayId = await resolveDayId(supabase, input.courseSlug, input.dayNumber);
  const target: ContentStatus = input.publish ? "published" : "draft";

  // Task: only if a prompt has been written.
  const { data: day } = await supabase
    .from("content_days")
    .select("task_prompt")
    .eq("id", dayId)
    .maybeSingle();
  if (day && String(day.task_prompt ?? "").trim()) {
    const { error } = await supabase
      .from("content_days")
      .update({ task_status: target })
      .eq("id", dayId);
    if (error) throw new Error(`Failed to publish task: ${error.message}`);
  }

  // Assets: every uploaded notes row for the day.
  const { error: assetError } = await supabase
    .from("content_assets")
    .update({ status: target })
    .eq("day_id", dayId);
  if (assetError) {
    throw new Error(`Failed to publish assets: ${assetError.message}`);
  }

  // Video parts: publish/unpublish every part of the day.
  const { error: videoError } = await supabase
    .from("content_day_videos")
    .update({ status: target })
    .eq("day_id", dayId);
  if (videoError) {
    throw new Error(`Failed to publish videos: ${videoError.message}`);
  }

  revalidateDay(input.courseSlug, input.dayNumber);
}

// ---------------------------------------------------------------------------
// Video parts — a day's class can be several ordered videos. Files upload to R2
// via the existing requestUploadUrl({ kind: "video" }); these record the rows.
// ---------------------------------------------------------------------------

type VideoPartInput = {
  key: string;
  fileName: string;
  contentType?: string | null;
  sizeBytes?: number | null;
  durationMin?: number | null;
};

/** Append a new video part to the end of a day's class (starts as draft). */
export async function addVideoPart(
  input: { courseSlug: string; dayNumber: number } & VideoPartInput,
): Promise<void> {
  const user = await assertAdmin();
  const supabase = await createClient();
  const dayId = await resolveDayId(supabase, input.courseSlug, input.dayNumber);

  const { data: last } = await supabase
    .from("content_day_videos")
    .select("position")
    .eq("day_id", dayId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const position = ((last?.position as number | undefined) ?? 0) + 1;

  const { error } = await supabase.from("content_day_videos").insert({
    day_id: dayId,
    position,
    r2_key: input.key,
    file_name: input.fileName,
    content_type: input.contentType ?? null,
    size_bytes: input.sizeBytes ?? null,
    duration_min: input.durationMin ?? null,
    status: "draft" as ContentStatus,
    uploaded_by: user.id,
  });
  if (error) throw new Error(`Failed to add video part: ${error.message}`);

  revalidateDay(input.courseSlug, input.dayNumber);
}

/** Swap a part's file for a freshly uploaded one; the old object is removed. */
export async function replaceVideoPart(
  input: { courseSlug: string; dayNumber: number; id: string } & VideoPartInput,
): Promise<void> {
  await assertAdmin();
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("content_day_videos")
    .select("r2_key")
    .eq("id", input.id)
    .maybeSingle();

  const { error } = await supabase
    .from("content_day_videos")
    .update({
      r2_key: input.key,
      file_name: input.fileName,
      content_type: input.contentType ?? null,
      size_bytes: input.sizeBytes ?? null,
      duration_min: input.durationMin ?? null,
    })
    .eq("id", input.id);
  if (error) throw new Error(`Failed to replace video part: ${error.message}`);

  const oldKey = (existing as { r2_key: string } | null)?.r2_key;
  if (oldKey && oldKey !== input.key) await deleteObject(oldKey).catch(() => {});

  revalidateDay(input.courseSlug, input.dayNumber);
}

/** Delete a video part, from both the DB and R2. */
export async function deleteVideoPart(input: {
  courseSlug: string;
  dayNumber: number;
  id: string;
}): Promise<void> {
  await assertAdmin();
  const supabase = await createClient();

  const { data: row } = await supabase
    .from("content_day_videos")
    .select("r2_key")
    .eq("id", input.id)
    .maybeSingle();

  const { error } = await supabase
    .from("content_day_videos")
    .delete()
    .eq("id", input.id);
  if (error) throw new Error(`Failed to delete video part: ${error.message}`);

  const key = (row as { r2_key: string } | null)?.r2_key;
  if (key) await deleteObject(key).catch(() => {});

  revalidateDay(input.courseSlug, input.dayNumber);
}

/** Mint an R2 key + presigned PUT for a video part's thumbnail image. */
export async function requestThumbnailUploadUrl(input: {
  courseSlug: string;
  dayNumber: number;
  fileName: string;
}): Promise<UploadTicket> {
  await assertAdmin();
  const key = buildVideoThumbnailKey(
    input.courseSlug,
    input.dayNumber,
    input.fileName,
  );
  return { key, uploadUrl: getUploadUrl(key) };
}

/** Attach (or replace) a part's thumbnail; the old image is removed from R2. */
export async function setVideoPartThumbnail(input: {
  courseSlug: string;
  dayNumber: number;
  id: string;
  key: string;
}): Promise<void> {
  await assertAdmin();
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("content_day_videos")
    .select("thumbnail_key")
    .eq("id", input.id)
    .maybeSingle();

  const { error } = await supabase
    .from("content_day_videos")
    .update({ thumbnail_key: input.key })
    .eq("id", input.id);
  if (error) throw new Error(`Failed to set thumbnail: ${error.message}`);

  const oldKey = (existing as { thumbnail_key: string | null } | null)
    ?.thumbnail_key;
  if (oldKey && oldKey !== input.key) await deleteObject(oldKey).catch(() => {});

  revalidateDay(input.courseSlug, input.dayNumber);
}

/** Remove a part's thumbnail, from both the DB and R2. */
export async function removeVideoPartThumbnail(input: {
  courseSlug: string;
  dayNumber: number;
  id: string;
}): Promise<void> {
  await assertAdmin();
  const supabase = await createClient();

  const { data: row } = await supabase
    .from("content_day_videos")
    .select("thumbnail_key")
    .eq("id", input.id)
    .maybeSingle();

  const { error } = await supabase
    .from("content_day_videos")
    .update({ thumbnail_key: null })
    .eq("id", input.id);
  if (error) throw new Error(`Failed to remove thumbnail: ${error.message}`);

  const key = (row as { thumbnail_key: string | null } | null)?.thumbnail_key;
  if (key) await deleteObject(key).catch(() => {});

  revalidateDay(input.courseSlug, input.dayNumber);
}

/** Set a part's title + description (the context students see). */
export async function updateVideoPart(input: {
  courseSlug: string;
  dayNumber: number;
  id: string;
  title: string;
  description: string;
}): Promise<void> {
  await assertAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("content_day_videos")
    .update({
      title: input.title.trim() || null,
      description: input.description.trim() || null,
    })
    .eq("id", input.id);
  if (error) throw new Error(`Failed to update video part: ${error.message}`);

  revalidateDay(input.courseSlug, input.dayNumber);
}

/** Publish / unpublish a single video part. */
export async function setVideoPartStatus(input: {
  courseSlug: string;
  dayNumber: number;
  id: string;
  status: ContentStatus;
}): Promise<void> {
  await assertAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("content_day_videos")
    .update({ status: input.status })
    .eq("id", input.id);
  if (error) throw new Error(`Failed to update video part: ${error.message}`);

  revalidateDay(input.courseSlug, input.dayNumber);
}

/** Reorder a part up or down, swapping positions with its neighbour. */
export async function moveVideoPart(input: {
  courseSlug: string;
  dayNumber: number;
  id: string;
  direction: "up" | "down";
}): Promise<void> {
  await assertAdmin();
  const supabase = await createClient();
  const dayId = await resolveDayId(supabase, input.courseSlug, input.dayNumber);

  const { data } = await supabase
    .from("content_day_videos")
    .select("id, position")
    .eq("day_id", dayId)
    .order("position", { ascending: true });
  const list = (data ?? []) as { id: string; position: number }[];

  const idx = list.findIndex((p) => p.id === input.id);
  if (idx === -1) return;
  const swapIdx = input.direction === "up" ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= list.length) return;

  const a = list[idx];
  const b = list[swapIdx];
  // Use a temporary position first to avoid the (day_id, position) unique clash.
  await supabase.from("content_day_videos").update({ position: -1 }).eq("id", a.id);
  await supabase
    .from("content_day_videos")
    .update({ position: a.position })
    .eq("id", b.id);
  await supabase
    .from("content_day_videos")
    .update({ position: b.position })
    .eq("id", a.id);

  revalidateDay(input.courseSlug, input.dayNumber);
}

// ---------------------------------------------------------------------------
// Daily task (text)
// ---------------------------------------------------------------------------

export async function saveDayTask(input: {
  courseSlug: string;
  dayNumber: number;
  title: string;
  prompt: string;
  status?: ContentStatus;
}): Promise<void> {
  await assertAdmin();
  const supabase = await createClient();
  const dayId = await resolveDayId(supabase, input.courseSlug, input.dayNumber);

  const prompt = input.prompt.trim();
  const status: ContentStatus =
    input.status ?? (prompt ? "draft" : "empty");

  const { error } = await supabase
    .from("content_days")
    .update({
      task_title: input.title.trim(),
      task_prompt: prompt,
      task_status: status,
    })
    .eq("id", dayId);
  if (error) throw new Error(`Failed to save task: ${error.message}`);

  revalidateDay(input.courseSlug, input.dayNumber);
}

/**
 * Batched save for one week: the week's title/focus (optional) plus any edited
 * daily tasks, in a single Server Action round trip. Backs the "Save" button so
 * edits are flushed deliberately rather than on every keystroke.
 */
export async function saveWeekEdits(input: {
  courseSlug: string;
  weekNumber: number;
  week?: { title: string; focus: string };
  days: { dayNumber: number; taskTitle: string; taskPrompt: string }[];
  /** Assets already PUT to R2 by the client; record them and drop replaced ones. */
  assets?: {
    dayNumber: number;
    kind: AssetKind;
    key: string;
    fileName: string;
    contentType?: string | null;
    sizeBytes?: number | null;
    durationMin?: number | null;
  }[];
}): Promise<void> {
  const user = await assertAdmin();
  const supabase = await createClient();

  const weekId = await resolveWeekId(supabase, input.courseSlug, input.weekNumber);

  if (input.week) {
    const { error } = await supabase
      .from("content_weeks")
      .update({
        title: input.week.title.trim(),
        focus: input.week.focus.trim(),
      })
      .eq("id", weekId);
    if (error) throw new Error(`Failed to save week: ${error.message}`);
  }

  if (input.days.length > 0) {
    // Map each day's weekday -> row id so we can update by id in one pass.
    const { data: rows } = await supabase
      .from("content_days")
      .select("id, weekday")
      .eq("week_id", weekId);
    const idByWeekday = new Map<number, string>();
    for (const r of (rows ?? []) as { id: string; weekday: number }[]) {
      idByWeekday.set(r.weekday, r.id);
    }

    await Promise.all(
      input.days.map(async (d) => {
        const weekday = ((d.dayNumber - 1) % TEACHING_DAYS_PER_WEEK) + 1;
        const id = idByWeekday.get(weekday);
        if (!id) return;
        const prompt = d.taskPrompt.trim();
        const { error } = await supabase
          .from("content_days")
          .update({
            task_title: d.taskTitle.trim(),
            task_prompt: prompt,
            task_status: (prompt ? "draft" : "empty") as ContentStatus,
          })
          .eq("id", id);
        if (error) throw new Error(`Failed to save task: ${error.message}`);
      }),
    );
  }

  if (input.assets && input.assets.length > 0) {
    const replacedKeys: string[] = [];
    for (const a of input.assets) {
      const dayId = await resolveDayId(supabase, input.courseSlug, a.dayNumber);

      const { data: existing } = await supabase
        .from("content_assets")
        .select("r2_key")
        .eq("day_id", dayId)
        .eq("kind", a.kind)
        .maybeSingle();

      const { error } = await supabase.from("content_assets").upsert(
        {
          day_id: dayId,
          kind: a.kind,
          r2_key: a.key,
          file_name: a.fileName,
          content_type: a.contentType ?? null,
          size_bytes: a.sizeBytes ?? null,
          duration_min: a.durationMin ?? null,
          status: "draft" as ContentStatus,
          uploaded_by: user.id,
        },
        { onConflict: "day_id,kind" },
      );
      if (error) throw new Error(`Failed to save asset: ${error.message}`);

      const oldKey = existing?.r2_key as string | undefined;
      if (oldKey && oldKey !== a.key) replacedKeys.push(oldKey);
    }

    // Best-effort cleanup of replaced objects; the rows already point elsewhere.
    await Promise.all(replacedKeys.map((k) => deleteObject(k).catch(() => {})));
  }

  revalidatePath(coursePath(input.courseSlug));
}

// ---------------------------------------------------------------------------
// Weeks — always within one course. Week numbers are 1..N per course, so every
// lookup and every renumber is filtered by course_id.
// ---------------------------------------------------------------------------

/** Append a new week (with 5 empty days) to the end of a course. */
export async function createWeek(
  courseSlug: string,
  title: string,
  focus: string,
): Promise<void> {
  await assertAdmin();
  const supabase = await createClient();
  const courseId = await resolveCourseId(supabase, courseSlug);

  const { data: last } = await supabase
    .from("content_weeks")
    .select("week_number")
    .eq("course_id", courseId)
    .order("week_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextNumber = (last?.week_number ?? 0) + 1;

  const { data: week, error } = await supabase
    .from("content_weeks")
    .insert({
      course_id: courseId,
      week_number: nextNumber,
      title: title.trim(),
      focus: focus.trim(),
    })
    .select("id")
    .single();
  if (error || !week) {
    throw new Error(`Failed to create week: ${error?.message}`);
  }

  const days = Array.from({ length: TEACHING_DAYS_PER_WEEK }, (_, i) => ({
    week_id: week.id,
    weekday: i + 1,
    title: `Day ${(nextNumber - 1) * TEACHING_DAYS_PER_WEEK + i + 1}`,
  }));
  const { error: daysError } = await supabase
    .from("content_days")
    .insert(days);
  if (daysError) throw new Error(`Failed to create days: ${daysError.message}`);

  revalidatePath(CONTENT_PATH);
  revalidatePath(coursePath(courseSlug));
}

export async function updateWeek(input: {
  courseSlug: string;
  weekNumber: number;
  title: string;
  focus: string;
}): Promise<void> {
  await assertAdmin();
  const supabase = await createClient();
  const weekId = await resolveWeekId(supabase, input.courseSlug, input.weekNumber);

  const { error } = await supabase
    .from("content_weeks")
    .update({ title: input.title.trim(), focus: input.focus.trim() })
    .eq("id", weekId);
  if (error) throw new Error(`Failed to update week: ${error.message}`);

  revalidatePath(coursePath(input.courseSlug));
}

/**
 * Remove a week from a course: delete its R2 objects, drop the row (days +
 * assets cascade), then pull every later week of THAT COURSE down by one so its
 * numbering stays 1..N contiguous. Other courses are untouched.
 */
export async function removeWeek(
  courseSlug: string,
  weekNumber: number,
): Promise<void> {
  await assertAdmin();
  const supabase = await createClient();
  const courseId = await resolveCourseId(supabase, courseSlug);

  const { data: week } = await supabase
    .from("content_weeks")
    .select("id, content_days(content_assets(r2_key), content_day_videos(r2_key, thumbnail_key))")
    .eq("course_id", courseId)
    .eq("week_number", weekNumber)
    .maybeSingle();
  if (!week) return;

  // Collect object keys before the cascade delete removes the rows.
  const keys = collectDayKeys(
    (week.content_days ?? []) as DayAssetRows[],
  );

  const { error } = await supabase
    .from("content_weeks")
    .delete()
    .eq("id", week.id);
  if (error) throw new Error(`Failed to remove week: ${error.message}`);

  // Renumber this course's later weeks ascending so each new number is free.
  const { data: later } = await supabase
    .from("content_weeks")
    .select("id, week_number")
    .eq("course_id", courseId)
    .gt("week_number", weekNumber)
    .order("week_number", { ascending: true });
  for (const w of (later ?? []) as { id: string; week_number: number }[]) {
    await supabase
      .from("content_weeks")
      .update({ week_number: w.week_number - 1 })
      .eq("id", w.id);
  }

  // R2 cleanup is best-effort; the DB is already consistent.
  await Promise.all(keys.map((k) => deleteObject(k).catch(() => {})));

  revalidatePath(CONTENT_PATH);
  revalidatePath(coursePath(courseSlug));
}

// ---------------------------------------------------------------------------
// Courses — the new top level. An admin creates the course first, then authors
// its weeks exactly as before.
// ---------------------------------------------------------------------------

type DayAssetRows = {
  content_assets: { r2_key: string }[] | null;
  content_day_videos: { r2_key: string; thumbnail_key: string | null }[] | null;
};

/** Every R2 key hanging off a set of days — notes, video parts, thumbnails. */
function collectDayKeys(days: DayAssetRows[]): string[] {
  const keys: string[] = [];
  for (const day of days) {
    for (const asset of day.content_assets ?? []) keys.push(asset.r2_key);
    for (const video of day.content_day_videos ?? []) {
      keys.push(video.r2_key);
      if (video.thumbnail_key) keys.push(video.thumbnail_key);
    }
  }
  return keys;
}

/** "Basic Course 2" -> "basic-course-2". Matches the DB's slug check. */
function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export type CourseResult = { ok: true; slug: string } | { ok: false; error: string };

/**
 * Create a course. The slug is derived from the title and must be unique — a
 * collision is reported back to the form rather than thrown, since "you already
 * have a course called that" is a normal thing for an admin to hit.
 */
export async function createCourse(input: {
  title: string;
  description: string;
  level: string;
}): Promise<CourseResult> {
  await assertAdmin();
  const supabase = await createClient();

  const title = input.title.trim();
  if (!title) return { ok: false, error: "Course name is required." };

  const slug = slugify(title);
  if (!slug) {
    return { ok: false, error: "Course name must contain letters or numbers." };
  }

  const { data: clash } = await supabase
    .from("content_courses")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (clash) return { ok: false, error: "A course with that name already exists." };

  const { data: last } = await supabase
    .from("content_courses")
    .select("position")
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("content_courses").insert({
    slug,
    title,
    description: input.description.trim(),
    level: input.level.trim(),
    position: ((last?.position as number | undefined) ?? 0) + 1,
    status: "draft" as ContentStatus,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath(CONTENT_PATH);
  return { ok: true, slug };
}

/**
 * Rename / re-describe a course. The SLUG IS NOT REGENERATED: it is in URLs the
 * admin may have bookmarked and in every R2 key already uploaded under it, so a
 * rename changes the label only.
 */
export async function updateCourse(input: {
  slug: string;
  title: string;
  description: string;
  level: string;
}): Promise<CourseResult> {
  await assertAdmin();
  const supabase = await createClient();

  const title = input.title.trim();
  if (!title) return { ok: false, error: "Course name is required." };

  const { error } = await supabase
    .from("content_courses")
    .update({
      title,
      description: input.description.trim(),
      level: input.level.trim(),
    })
    .eq("slug", input.slug);
  if (error) return { ok: false, error: error.message };

  revalidatePath(CONTENT_PATH);
  revalidatePath(coursePath(input.slug));
  return { ok: true, slug: input.slug };
}

/**
 * Publish / unpublish a course. Unpublishing hides it from the assignment
 * dropdown for new students; students already on it keep their content, since
 * pulling a course out from under a mid-programme student would be worse than
 * leaving it visible.
 */
export async function setCourseStatus(input: {
  slug: string;
  status: ContentStatus;
}): Promise<void> {
  await assertAdmin();
  const supabase = await createClient();

  const { error } = await supabase
    .from("content_courses")
    .update({ status: input.status })
    .eq("slug", input.slug);
  if (error) throw new Error(`Failed to update course: ${error.message}`);

  revalidatePath(CONTENT_PATH);
  revalidatePath(coursePath(input.slug));
}

/**
 * Delete a course and everything under it. The DB cascade removes weeks, days,
 * assets, quizzes, submissions and progress; students on the course are
 * unassigned (`on delete set null`) rather than deleted.
 *
 * Refused while students are still assigned — an admin should move them first,
 * because this destroys their progress. That check is deliberate friction, not
 * a technical limit.
 */
export async function deleteCourse(slug: string): Promise<CourseResult> {
  await assertAdmin();
  const supabase = await createClient();

  const { data: course } = await supabase
    .from("content_courses")
    .select("id, content_weeks(content_days(content_assets(r2_key), content_day_videos(r2_key, thumbnail_key)))")
    .eq("slug", slug)
    .maybeSingle();
  if (!course) return { ok: false, error: "Course not found." };

  const { count } = await supabase
    .from("student_access")
    .select("student_id", { count: "exact", head: true })
    .eq("course_id", course.id);
  if ((count ?? 0) > 0) {
    return {
      ok: false,
      error: `${count} student${count === 1 ? " is" : "s are"} still assigned to this course. Move them to another course first.`,
    };
  }

  // Collect object keys before the cascade delete removes the rows.
  const weeks = (course.content_weeks ?? []) as {
    content_days: DayAssetRows[] | null;
  }[];
  const keys = collectDayKeys(weeks.flatMap((w) => w.content_days ?? []));

  const { error } = await supabase
    .from("content_courses")
    .delete()
    .eq("id", course.id);
  if (error) return { ok: false, error: error.message };

  await Promise.all(keys.map((k) => deleteObject(k).catch(() => {})));

  revalidatePath(CONTENT_PATH);
  return { ok: true, slug };
}
