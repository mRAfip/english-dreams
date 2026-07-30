import { notFound } from "next/navigation";
import { DayDetail } from "@/components/admin/day-detail";
import { getDay } from "@/lib/content/queries";
import { getTaskQuestions } from "@/lib/tasks/queries";
import { getDownloadUrl } from "@/lib/r2/presign";
import { isR2Configured } from "@/lib/r2/client";
import { TOTAL_TEACHING_DAYS } from "@/types/content";

// Admin > Content > one teaching day — uploaded material + cohort engagement.
export default async function Page(
  props: PageProps<"/admin/content-management/[dayNumber]">,
) {
  const { dayNumber } = await props.params;

  const parsed = Number(dayNumber);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > TOTAL_TEACHING_DAYS) {
    notFound();
  }

  const found = await getDay(parsed);
  if (!found) notFound();

  const questions = await getTaskQuestions(parsed);

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
