import { randomUUID } from "node:crypto";
import { TEACHING_DAYS_PER_WEEK } from "@/types/content";

// R2 object-key layout. One place owns the folder structure so uploads,
// deletes, and serving all agree on where a file lives.
//
//   content/week-03/day-12/video/<uuid>-<slug>.mp4
//   content/week-03/day-12/notes/<uuid>-<slug>.pdf
//
// Keys are grouped by week then day so the bucket browses like the curriculum,
// and the leaf is uuid-prefixed so re-uploading the same filename never clobbers
// a previous object (old objects are deleted explicitly on replace).

export type AssetKind = "video" | "notes";

/** Zero-pad so lexical order matches numeric order in the R2 browser. */
function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Lowercase, strip to a safe slug, keep the extension. `My Notes.PDF` -> `my-notes.pdf`. */
export function safeFileName(name: string): string {
  const dot = name.lastIndexOf(".");
  const base = (dot > 0 ? name.slice(0, dot) : name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  const ext =
    dot > 0
      ? name.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]+/g, "")
      : "";
  const stem = base || "file";
  return ext ? `${stem}.${ext}` : stem;
}

export function weekNumberForDay(dayNumber: number): number {
  return Math.floor((dayNumber - 1) / TEACHING_DAYS_PER_WEEK) + 1;
}

/**
 * Build the object key for a day's asset. `dayNumber` is the 1..60 teaching-day
 * number; the week folder is derived from it.
 */
export function buildAssetKey(
  dayNumber: number,
  kind: AssetKind,
  fileName: string,
): string {
  const week = weekNumberForDay(dayNumber);
  return `content/week-${pad(week)}/day-${pad(dayNumber)}/${kind}/${randomUUID()}-${safeFileName(fileName)}`;
}

/**
 * Build the object key for a student's completion certificate.
 *
 *   certificates/<studentId>/<uuid>-<slug>.pdf
 */
export function buildCertificateKey(
  studentId: string,
  fileName: string,
): string {
  return `certificates/${studentId}/${randomUUID()}-${safeFileName(fileName)}`;
}

/**
 * Build the object key for a user's avatar.
 *
 *   avatars/<userId>/<uuid>-<slug>.png
 */
export function buildAvatarKey(userId: string, fileName: string): string {
  return `avatars/${userId}/${randomUUID()}-${safeFileName(fileName)}`;
}

/**
 * Build the object key for a video part's thumbnail image.
 *
 *   content/week-03/day-12/thumbnails/<uuid>-<slug>.jpg
 */
export function buildVideoThumbnailKey(
  dayNumber: number,
  fileName: string,
): string {
  const week = weekNumberForDay(dayNumber);
  return `content/week-${pad(week)}/day-${pad(dayNumber)}/thumbnails/${randomUUID()}-${safeFileName(fileName)}`;
}

/**
 * Build the object key for a task-submission audio answer.
 *
 *   submissions/<studentId>/<uuid>-<slug>.webm
 */
export function buildSubmissionAudioKey(
  studentId: string,
  fileName: string,
): string {
  return `submissions/${studentId}/${randomUUID()}-${safeFileName(fileName)}`;
}

/**
 * Build the object key for a chat message attachment.
 *
 *   messages/<conversationId>/<uuid>-<slug>.webm
 */
export function buildMessageAttachmentKey(
  conversationId: string,
  fileName: string,
): string {
  return `messages/${conversationId}/${randomUUID()}-${safeFileName(fileName)}`;
}
