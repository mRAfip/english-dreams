import { notFound } from "next/navigation";
import { DayDetail } from "@/components/admin/day-detail";
import { getCourseBySlug, getDay } from "@/lib/content/queries";
import { getTaskQuestions } from "@/lib/tasks/queries";
import { getDownloadUrl } from "@/lib/r2/presign";
import { isR2Configured } from "@/lib/r2/client";

// Admin > Content > one course > one teaching day — uploaded material + cohort
// engagement. The day number is scoped to the course in the URL: /basic/12 and
// /intermediate/12 are different days, so both segments are needed to resolve
// the row. There is no fixed upper bound any more — a day exists if the course
// has been authored that far, which getDay() answers.
export default async function Page({
  params,
}: {
  params: Promise<{ courseSlug: string; dayNumber: string }>;
}) {
  const { courseSlug, dayNumber } = await params;

  const parsed = Number(dayNumber);
  if (!Number.isInteger(parsed) || parsed < 1) notFound();

  const course = await getCourseBySlug(courseSlug);
  if (!course) notFound();

  const found = await getDay(course.id, parsed);
  if (!found) notFound();

  const questions = await getTaskQuestions(course.id, parsed);

  // Resolve serving URLs for whatever is uploaded (public URL or presigned GET).
  const configured = isR2Configured();
  const videoUrls = configured
    ? Object.fromEntries(
        found.day.videos.map((p) => [p.id, getDownloadUrl(p.assetKey)]),
      )
    : {};
  const thumbnailUrls = configured
    ? Object.fromEntries(
        found.day.videos
          .filter((p) => p.thumbnailKey)
          .map((p) => [p.id, getDownloadUrl(p.thumbnailKey as string)]),
      )
    : {};
  const notesKey =
    configured && found.day.notes.assetKey ? found.day.notes.assetKey : null;
  const notesViewUrl = notesKey ? getDownloadUrl(notesKey, "inline") : null;
  const notesDownloadUrl = notesKey
    ? getDownloadUrl(notesKey, "attachment")
    : null;

  return (
    <DayDetail
      course={course}
      day={found.day}
      week={found.week}
      videoUrls={videoUrls}
      thumbnailUrls={thumbnailUrls}
      questions={questions}
      notesViewUrl={notesViewUrl}
      notesDownloadUrl={notesDownloadUrl}
    />
  );
}
