"use client";

import Link from "next/link";
import {
  ArrowLeft,
  ClipboardList,
  Download,
  Eye,
  FileText,
  Video,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AssetUploadButton } from "@/components/admin/asset-upload-button";
import { VideoPartsManager } from "@/components/admin/video-parts-manager";
import { TaskBuilder } from "@/components/admin/task-builder";
import type { TaskQuestion } from "@/types/task";
import {
  TEACHING_DAYS_PER_WEEK,
  type ContentStatus,
  type Course,
  type CurriculumDay,
  type CurriculumWeek,
} from "@/types/content";
import { STATUS_LABEL, STATUS_VARIANT } from "@/lib/content/status";

export type DayDetailTab = "videos" | "notes" | "task";

// Admin > Content > Day detail — author the day's material as tabs (Videos,
// Notes, Task) rather than one long scroll. Video + notes upload directly to R2;
// the serving URLs are resolved server-side and passed in.

export function DayDetail({
  course,
  day,
  week,
  videoUrls,
  thumbnailUrls,
  questions,
  notesViewUrl,
  notesDownloadUrl,
  initialTab,
}: {
  course: Course;
  day: CurriculumDay;
  week: CurriculumWeek;
  videoUrls: Record<string, string>;
  thumbnailUrls: Record<string, string>;
  questions: TaskQuestion[];
  notesViewUrl: string | null;
  notesDownloadUrl: string | null;
  initialTab: DayDetailTab;
}) {
  return (
    <div className="mx-auto max-w-4xl">
      <Link
        href={`/admin/content-management/${course.slug}`}
        className="inline-flex items-center gap-2 text-sm font-semibold text-body transition-colors hover:text-ink"
      >
        <ArrowLeft className="size-4" />
        {course.title}
      </Link>

      {/* Everything for the day lives in one card: header, then the tabs. */}
      <div className="mt-4 rounded-2xl border border-border bg-card">
        <header className="flex items-center gap-4 border-b border-border p-4 sm:p-6">
          <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-primary-pale font-display text-lg font-extrabold text-ink-deep">
            {day.dayNumber}
          </span>
          <div className="flex flex-col gap-1">
            <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink">
              {day.title}
            </h1>
            <p className="text-sm text-body">
              Week {week.weekNumber} · {week.title} — weekday {day.weekday} of{" "}
              {TEACHING_DAYS_PER_WEEK}
            </p>
          </div>
        </header>

        <div className="p-4 sm:p-6">
          {/* Material — one tab per kind so authoring stays focused. */}
          <Tabs defaultValue={initialTab}>
            <TabsList className="w-full">
              <TabTrigger value="videos" icon={Video} label="Videos" status={day.video.status} />
              <TabTrigger value="notes" icon={FileText} label="Notes" status={day.notes.status} />
              <TabTrigger value="task" icon={ClipboardList} label="Task" status={day.task.status} />
            </TabsList>

            <TabsContent value="videos" className="mt-5">
              <VideoPartsManager
                courseSlug={course.slug}
                dayNumber={day.dayNumber}
                parts={day.videos}
                videoUrls={videoUrls}
                thumbnailUrls={thumbnailUrls}
              />
            </TabsContent>

            <TabsContent value="notes" className="mt-5">
          <AssetPanel
            icon={FileText}
            label="Notes"
            title={day.notes.title}
            status={day.notes.status}
            action={
              <AssetUploadButton
                courseSlug={course.slug}
                dayNumber={day.dayNumber}
                kind="notes"
                label={day.notes.assetKey ? "Replace file" : "Upload file"}
              />
            }
          >
            {day.notes.assetKey ? (
              <div className="flex items-center justify-between gap-4 rounded-lg border border-border px-4 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <FileText className="size-4 shrink-0 text-mute" />
                  <span className="truncate text-sm text-body">
                    {day.notes.fileName ?? day.notes.assetKey}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {notesViewUrl ? (
                    <Button variant="secondary" size="sm" asChild>
                      <a
                        href={notesViewUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Eye />
                        View
                      </a>
                    </Button>
                  ) : null}
                  {notesDownloadUrl ? (
                    <Button variant="ghost" size="sm" asChild>
                      <a href={notesDownloadUrl}>
                        <Download />
                        Download
                      </a>
                    </Button>
                  ) : null}
                </div>
              </div>
            ) : (
              <Missing message="No notes attached for this day yet." />
            )}
              </AssetPanel>
            </TabsContent>

            <TabsContent value="task" className="mt-5">
              <TaskBuilder
                courseSlug={course.slug}
                dayNumber={day.dayNumber}
                questions={questions}
                status={day.task.status}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

/** A tab with the material's publish status shown as a small dot. */
function TabTrigger({
  value,
  icon: Icon,
  label,
  status,
}: {
  value: string;
  icon: LucideIcon;
  label: string;
  status: ContentStatus;
}) {
  const dot =
    status === "published"
      ? "bg-positive"
      : status === "draft"
        ? "bg-warning"
        : "bg-border";
  return (
    <TabsTrigger value={value} className="flex-1 justify-center">
      <Icon className="size-4" />
      {label}
      <span className={`size-1.5 rounded-full ${dot}`} aria-hidden />
    </TabsTrigger>
  );
}

function AssetPanel({
  icon: Icon,
  label,
  title,
  status,
  action,
  children,
}: {
  icon: LucideIcon;
  label: string;
  title: string;
  status: ContentStatus;
  action: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <article className="rounded-xl border border-border">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <Icon className="size-4 shrink-0 text-mute" />
          <div className="min-w-0">
            <div className="text-sm font-semibold text-ink">{label}</div>
            <div className="truncate text-xs text-mute">{title}</div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <Badge variant={STATUS_VARIANT[status]}>{STATUS_LABEL[status]}</Badge>
          {action}
        </div>
      </div>
      <div className="p-4">{children}</div>
    </article>
  );
}

function Missing({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-mute">
      {message}
    </div>
  );
}
