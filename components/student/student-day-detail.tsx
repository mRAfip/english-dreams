"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  FileText,
  Lock,
  PlayCircle,
  Video,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  markNotesDownloaded,
  markVideoPartWatched,
} from "@/lib/student/actions";
import { StudentTaskPanel } from "@/components/student/student-task-panel";
import { PdfViewerModal } from "@/components/ui/pdf-viewer-modal";
import type { StudentDay } from "@/lib/student/progress";
import type {
  ReviewComment,
  TaskQuestion,
  TaskSubmission,
} from "@/types/task";
import type { Role } from "@/types/role";

export type TaskData = {
  questions: TaskQuestion[];
  submission: TaskSubmission | null;
  meId: string;
  comments: ReviewComment[];
  threadAuthors: Record<string, { name: string; role: Role | null }>;
};

export type StudentDayDetailTab = "videos" | "notes" | "task";

// Student > Learning path > one day. A playlist layout: the active video plays
// on top, the Videos tab lists every part to switch between, then Notes and
// Task. The day counts as watched only once every part has been played.

export type DayVideo = {
  id: string;
  title: string;
  description: string | null;
  durationMin: number | null;
  watched: boolean;
  url: string | null;
  thumbnailUrl: string | null;
};

export function StudentDayDetail({
  day,
  weekNumber,
  weekTitle,
  videos,
  notesViewUrl,
  notesDownloadUrl,
  task,
  initialTab = "videos",
}: {
  day: StudentDay;
  weekNumber: number;
  weekTitle: string;
  videos: DayVideo[];
  notesViewUrl: string | null;
  notesDownloadUrl: string | null;
  task: TaskData;
  initialTab?: StudentDayDetailTab;
}) {
  const router = useRouter();
  const [, startTransition] = React.useTransition();

  // Optimistic local state for watched video parts so video playback NEVER resets/restarts on router.refresh
  const [watchedPartIds, setWatchedPartIds] = React.useState<Set<string>>(
    () => new Set(videos.filter((v) => v.watched).map((v) => v.id)),
  );

  // Sync initial server watched state into watchedPartIds if props update
  React.useEffect(() => {
    setWatchedPartIds((prev) => {
      const next = new Set(prev);
      for (const v of videos) {
        if (v.watched) next.add(v.id);
      }
      return next;
    });
  }, [videos]);

  // Derived list of videos with optimistic watched flag
  const videosList = React.useMemo(() => {
    return videos.map((v) => ({
      ...v,
      watched: v.watched || watchedPartIds.has(v.id),
    }));
  }, [videos, watchedPartIds]);

  // Start on the first part the student hasn't watched yet, else the first.
  const [activeId, setActiveId] = React.useState<string | null>(
    () => videosList.find((v) => !v.watched)?.id ?? videosList[0]?.id ?? null,
  );

  const [activeTab, setActiveTab] = React.useState<StudentDayDetailTab>(initialTab);
  const [viewerOpen, setViewerOpen] = React.useState(false);

  const active = videosList.find((v) => v.id === activeId) ?? videosList[0] ?? null;

  // Lock active video URL per part ID so presigned query updates never reload the playing HTML5 video element
  const stableUrlMapRef = React.useRef<Map<string, string>>(new Map());
  if (active?.id && active?.url && !stableUrlMapRef.current.has(active.id)) {
    stableUrlMapRef.current.set(active.id, active.url);
  }
  const activeVideoUrl = active?.id ? (stableUrlMapRef.current.get(active.id) ?? active.url) : null;

  // Done once a submission exists that isn't awaiting a redo.
  const completed =
    task.submission !== null && task.submission.status !== "redo";
  const notesDone = day.notes.downloaded;
  const allWatched =
    day.video.watched ||
    (videosList.length > 0 && videosList.every((v) => v.watched));

  function record(action: () => Promise<void>) {
    startTransition(async () => {
      await action();
      router.refresh();
    });
  }

  function onPartPlay(partId: string) {
    if (watchedPartIds.has(partId)) return;
    setWatchedPartIds((prev) => new Set(prev).add(partId));
    // Persist to database silently in background without router.refresh to prevent restarting video
    markVideoPartWatched(day.dayNumber, partId).catch(() => {});
  }

  function onDownload() {
    if (!day.notes.downloaded) record(() => markNotesDownloaded(day.dayNumber));
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/student/learning-path"
        className="inline-flex items-center gap-2 text-sm font-semibold text-body transition-colors hover:text-ink"
      >
        <ArrowLeft className="size-4" />
        Learning path
      </Link>

      {day.state === "locked" ? (
        <div className="mt-4 rounded-2xl border border-border bg-card p-10">
          <div className="flex flex-col items-center gap-2 text-center">
            <Lock className="size-6 text-mute" />
            <p className="text-sm text-body">
              This day isn&apos;t available yet. It unlocks once your trainers
              publish it.
            </p>
          </div>
        </div>
      ) : (
        <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-card">
          {/* Active video on top */}
          {activeVideoUrl ? (
            <video
              key={active.id}
              controls
              controlsList="nodownload"
              preload="metadata"
              poster={active.thumbnailUrl ?? undefined}
              onPlay={() => onPartPlay(active.id)}
              className="aspect-video w-full bg-black"
              src={activeVideoUrl}
            />
          ) : (
            <div className="grid aspect-video w-full place-items-center bg-secondary">
              <div className="flex flex-col items-center gap-2 text-center text-mute">
                <Video className="size-6" />
                <p className="text-sm">The class video isn&apos;t available yet.</p>
              </div>
            </div>
          )}

          <div className="p-4 sm:p-6">
            {/* Active title + day meta */}
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h1 className="font-display text-xl font-extrabold tracking-tight text-ink">
                  {active?.title ?? day.title}
                </h1>
                <p className="mt-1 text-sm text-body">
                  {day.title} · Day {day.dayNumber} · Week {weekNumber} ·{" "}
                  {weekTitle}
                </p>
                {active?.description ? (
                  <p className="mt-2 text-sm text-body">{active.description}</p>
                ) : null}
              </div>
              {allWatched && videos.length > 0 ? (
                <Badge variant="positive" className="shrink-0">
                  <CheckCircle2 className="size-3.5" />
                  Watched
                </Badge>
              ) : null}
            </div>

            {/* Videos / Notes / Task */}
            <Tabs
              value={activeTab}
              onValueChange={(value) =>
                setActiveTab(value as StudentDayDetailTab)
              }
              className="mt-5"
            >
              <TabsList className="w-full">
                <TabsTrigger
                  value="videos"
                  className="flex-1 justify-center gap-1.5 data-[state=active]:bg-[#043556] data-[state=active]:text-white px-2 sm:px-4 py-2 sm:py-2.5"
                >
                  <Video className="size-4 hidden sm:block" />
                  <span className="text-xs sm:text-sm font-semibold">Classes</span>
                  {videos.length > 0 ? (
                    <span className={cn("text-[10px] sm:text-xs", activeTab === "videos" ? "text-white/80" : "text-mute")}>
                      ({videos.length})
                    </span>
                  ) : null}
                </TabsTrigger>
                <TabsTrigger
                  value="notes"
                  className="flex-1 justify-center gap-1.5 data-[state=active]:bg-[#043556] data-[state=active]:text-white px-2 sm:px-4 py-2 sm:py-2.5"
                >
                  <FileText className="size-4 hidden sm:block" />
                  <span className="text-xs sm:text-sm font-semibold">Notes</span>
                  {notesDone ? (
                    <CheckCircle2 className={cn("size-3.5", activeTab === "notes" ? "text-white" : "text-emerald-500")} />
                  ) : null}
                </TabsTrigger>
                <TabsTrigger
                  value="task"
                  disabled={!allWatched && !completed}
                  className="flex-1 justify-center gap-1.5 data-[state=active]:bg-[#043556] data-[state=active]:text-white px-2 sm:px-4 py-2 sm:py-2.5 disabled:opacity-50"
                >
                  {!allWatched && !completed ? (
                    <Lock className="size-4 hidden sm:block" />
                  ) : (
                    <CheckCircle2 className="size-4 hidden sm:block" />
                  )}
                  <span className="text-xs sm:text-sm font-semibold">Task</span>
                  {completed ? (
                    <CheckCircle2 className={cn("size-3.5", activeTab === "task" ? "text-white" : "text-emerald-500")} />
                  ) : !allWatched ? (
                    <Lock className="size-3.5 text-mute" />
                  ) : null}
                </TabsTrigger>
              </TabsList>

              {/* Videos — the playlist */}
              <TabsContent value="videos" className="mt-4">
                {videosList.length === 0 ? (
                  <Missing message="The class video isn't available yet." />
                ) : (
                  <ul className="flex flex-col gap-2">
                    {videosList.map((part, i) => (
                      <li key={part.id}>
                        <PlaylistRow
                          part={part}
                          index={i}
                          active={part.id === active?.id}
                          onSelect={() => {
                            setActiveId(part.id);
                            onPartPlay(part.id);
                          }}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </TabsContent>

              {/* Notes */}
              <TabsContent value="notes" className="mt-5">
                {notesViewUrl ? (
                  <div className="rounded-xl border border-border p-4">
                    <div className="flex items-center gap-3">
                      <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-secondary text-mute">
                        <FileText className="size-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold text-ink">
                          {day.notes.title}
                        </div>
                        <div className="text-xs text-mute">PDF handout</div>
                      </div>
                    </div>
                    <div className="mt-4 flex items-center gap-2">
                      <Button
                        variant="soft"
                        size="sm"
                        onClick={() => {
                          onDownload();
                          setViewerOpen(true);
                        }}
                      >
                        <Eye />
                        View
                      </Button>
                      {notesDownloadUrl ? (
                        <Button
                          variant="secondary"
                          size="sm"
                          asChild
                          onClick={onDownload}
                        >
                          <a href={notesDownloadUrl}>
                            <Download />
                            Download
                          </a>
                        </Button>
                      ) : null}
                    </div>

                    <PdfViewerModal
                      isOpen={viewerOpen}
                      onClose={() => setViewerOpen(false)}
                      title={day.notes.title}
                      viewUrl={notesViewUrl}
                      downloadUrl={notesDownloadUrl}
                      fileName={day.notes.title}
                    />
                  </div>
                ) : (
                  <Missing message="No notes attached for this day yet." />
                )}
              </TabsContent>

              {/* Task */}
              <TabsContent value="task" className="mt-5">
                <StudentTaskPanel
                  dayNumber={day.dayNumber}
                  questions={task.questions}
                  submission={task.submission}
                  meId={task.meId}
                  comments={task.comments}
                  threadAuthors={task.threadAuthors}
                />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      )}
    </div>
  );
}

/** One row of the video playlist — tap to load it into the player above. */
function PlaylistRow({
  part,
  index,
  active,
  onSelect,
}: {
  part: DayVideo;
  index: number;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={active ? "true" : undefined}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl border p-2.5 text-left transition-colors",
        active
          ? "border-primary/40 bg-primary-pale"
          : "border-border bg-card hover:border-mute/40 hover:bg-muted",
      )}
    >
      {/* Thumbnail tile */}
      <span
        className={cn(
          "relative grid aspect-video w-24 shrink-0 place-items-center overflow-hidden rounded-lg sm:w-28",
          active ? "bg-primary text-primary-foreground" : "bg-secondary text-mute",
        )}
      >
        {part.thumbnailUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={part.thumbnailUrl}
              alt=""
              className="absolute inset-0 size-full object-cover"
            />
            <span className="absolute inset-0 grid place-items-center bg-black/35 text-primary-foreground">
              <PlayCircle className="size-6" />
            </span>
          </>
        ) : (
          <PlayCircle className="size-6" />
        )}
        <span className="absolute left-1 top-1 rounded bg-black/75 px-1 text-[10px] font-bold text-primary-foreground">
          {index + 1}
        </span>
      </span>

      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="line-clamp-2 text-sm font-semibold text-ink">
          {part.title}
        </span>
        {part.description ? (
          <span className="line-clamp-1 text-xs text-mute">
            {part.description}
          </span>
        ) : null}
        <span className="flex items-center gap-2 text-xs text-mute">
          {part.durationMin ? (
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3.5" />
              {part.durationMin} min
            </span>
          ) : null}
          {part.watched ? (
            <span className="inline-flex items-center gap-1 text-positive-deep">
              <CheckCircle2 className="size-3.5" />
              Watched
            </span>
          ) : active ? (
            <span className="text-ink-deep">Now playing</span>
          ) : null}
        </span>
      </span>
    </button>
  );
}

function Missing({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-mute">
      {message}
    </div>
  );
}
