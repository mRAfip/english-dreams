import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/guards";
import { loadJourney } from "@/lib/student/journey";
import { getDay } from "@/lib/content/queries";
import {
  getReviewComments,
  getSubmission,
  getTaskQuestions,
} from "@/lib/tasks/queries";
import { createClient } from "@/lib/supabase/server";
import { participantInfo } from "@/lib/inbox/participants";
import { getDownloadUrl } from "@/lib/r2/presign";
import { isR2Configured } from "@/lib/r2/client";
import { StudentDayDetail } from "@/components/student/student-day-detail";
import type { Role } from "@/types/role";

// Student > Learning path > one day — watch the class, download the notes,
// complete the task. Content comes from the admin-authored tables; progress is
// recorded per student.
//
// The day number in the URL is relative to THE STUDENT'S OWN COURSE, resolved
// from their journey. A student never sees another course's day: the journey
// only contains their course's days, so an out-of-range number 404s.
export default async function Page(
  props: PageProps<"/student/learning-path/[dayNumber]">,
) {
  const user = await requireRole("student");
  const { dayNumber } = await props.params;

  const n = Number(dayNumber);
  if (!Number.isInteger(n) || n < 1) notFound();

  const journey = await loadJourney();
  if (!journey.course) notFound();
  const week = journey.weeks.find((w) =>
    w.days.some((d) => d.dayNumber === n),
  );
  const day = week?.days.find((d) => d.dayNumber === n);
  if (!week || !day) notFound();

  // Serving URLs for whatever is published (public URL or presigned GET).
  const content = await getDay(journey.course.id, n);
  const configured = isR2Configured();

  // Merge the day's published video parts (with keys, from content) with the
  // student's per-part watched state (from the journey), resolving a URL each.
  const urlByPart = new Map<string, string>();
  const thumbByPart = new Map<string, string>();
  if (configured && content) {
    for (const p of content.day.videos) {
      if (p.status === "published") {
        urlByPart.set(p.id, getDownloadUrl(p.assetKey));
        if (p.thumbnailKey) thumbByPart.set(p.id, getDownloadUrl(p.thumbnailKey));
      }
    }
  }
  const videos = day.videos.map((v) => ({
    id: v.id,
    title: v.title,
    description: v.description,
    durationMin: v.durationMin,
    watched: v.watched,
    url: urlByPart.get(v.id) ?? null,
    thumbnailUrl: thumbByPart.get(v.id) ?? null,
  }));

  const notesKey =
    configured &&
    content?.day.notes.status === "published" &&
    content.day.notes.assetKey
      ? content.day.notes.assetKey
      : null;
  // Inline for reading in a new tab; attachment forces a save.
  const notesViewUrl = notesKey ? getDownloadUrl(notesKey, "inline") : null;
  const notesDownloadUrl = notesKey
    ? getDownloadUrl(notesKey, "attachment")
    : null;

  // Task: questions, the student's submission, and the review thread.
  const [questions, submission] = await Promise.all([
    getTaskQuestions(journey.course.id, n),
    getSubmission(journey.course.id, n, user.id),
  ]);
  const comments = submission ? await getReviewComments(submission.id) : [];

  // Author names for realtime comment resolution: the student + their trainer.
  const threadAuthors: Record<string, { name: string; role: Role | null }> = {
    [user.id]: { name: user.fullName ?? user.email, role: "student" },
  };
  const supabase = await createClient();
  const { data: link } = await supabase
    .from("student_trainer_assignments")
    .select("trainer_id")
    .eq("student_id", user.id)
    .maybeSingle();
  const trainerId = (link as { trainer_id: string | null } | null)?.trainer_id;
  if (trainerId) {
    const info = await participantInfo([trainerId]);
    const t = info.get(trainerId);
    threadAuthors[trainerId] = { name: t?.name ?? "Trainer", role: t?.role ?? "trainer" };
  }

  return (
    <StudentDayDetail
      day={day}
      weekNumber={week.weekNumber}
      weekTitle={week.title}
      videos={videos}
      notesViewUrl={notesViewUrl}
      notesDownloadUrl={notesDownloadUrl}
      task={{ questions, submission, meId: user.id, comments, threadAuthors }}
    />
  );
}
