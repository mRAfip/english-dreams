"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ClipboardList,
  Eye,
  FileText,
  Globe,
  EyeOff,
  ListChecks,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  Upload,
  Video,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { FilePickButton } from "@/components/admin/file-pick-button";
import { curriculumStats, teachingDayCount } from "@/lib/content/curriculum";
import {
  createWeek,
  removeWeek,
  requestUploadUrl,
  saveWeekEdits,
  setDayPublished,
} from "@/lib/content/actions";
import type { AssetKind } from "@/lib/r2/keys";
import { STATUS_LABEL, STATUS_VARIANT } from "@/lib/content/status";
import {
  QUIZZES_PER_WEEK,
  TEACHING_DAYS_PER_WEEK,
  type Course,
  type CurriculumDay,
  type CurriculumWeek,
  type WeekendQuiz,
} from "@/types/content";

// Admin > Content > one course — author its weeks and days, backed by Supabase.
//
// Everything on this screen belongs to ONE course: the week rail, the day cards,
// the quizzes, and every Server Action called from here carries `course.slug`.
// A course is as long as it has been authored — there is no fixed 60 days.
//
// Editing model: text edits (a week's title/focus and each day's daily task) are
// STAGED locally and flushed to the backend in a single batched request via the
// floating Save bar — nothing hits the DB on every keystroke. Switching weeks,
// adding/removing a week, or leaving the page while edits are pending prompts to
// save first. Uploads are the exception: video/notes transfer straight to R2 the
// moment a file is picked, so they save immediately and don't stage.

/** A file picked but not yet uploaded — held until Save. Keyed by `day:kind`. */
type StagedAsset = { dayNumber: number; kind: AssetKind; file: File };

const assetKey = (dayNumber: number, kind: AssetKind) => `${dayNumber}:${kind}`;

/** Read a video file's duration (minutes) in the browser. Null if unreadable. */
function probeDurationMin(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      const s = video.duration;
      resolve(Number.isFinite(s) ? Math.max(1, Math.round(s / 60)) : null);
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    video.src = url;
  });
}

export function ContentManager({
  course,
  weeks,
}: {
  course: Course;
  weeks: CurriculumWeek[];
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [selected, setSelected] = React.useState(1);

  // --- staged (unsaved) edits for the selected week ---
  const [weekEdit, setWeekEdit] = React.useState<{
    title: string;
    focus: string;
  } | null>(null);
  const [assetEdits, setAssetEdits] = React.useState<
    Record<string, StagedAsset>
  >({});

  // --- dialog / confirmation state ---
  const [editingWeek, setEditingWeek] = React.useState(false);
  const [addingWeek, setAddingWeek] = React.useState(false);
  const [confirmRemove, setConfirmRemove] = React.useState(false);
  // A navigation the user tried while there were unsaved changes.
  const [pendingNav, setPendingNav] = React.useState<{ run: () => void } | null>(
    null,
  );

  const editCount = Object.keys(assetEdits).length + (weekEdit ? 1 : 0);
  const dirty = editCount > 0;

  const clamped = Math.min(selected, weeks.length || 1);
  const week = weeks[clamped - 1];
  const stats = curriculumStats(weeks);

  // Warn on tab close / reload while there are unsaved edits.
  React.useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  function clearEdits() {
    setWeekEdit(null);
    setAssetEdits({});
  }

  /**
   * Flush everything staged for the current week in one commit: upload each
   * picked file directly to R2, then write tasks + week + asset rows in a single
   * server request. Nothing reaches the backend until this runs.
   */
  async function flush() {
    if (!dirty || !week) return;

    // 1. Upload staged files straight to R2 (browser -> R2), collect metadata.
    const staged = Object.values(assetEdits);
    const assets: {
      dayNumber: number;
      kind: AssetKind;
      key: string;
      fileName: string;
      contentType: string | null;
      sizeBytes: number;
      durationMin: number | null;
    }[] = [];
    for (const s of staged) {
      const { key, uploadUrl } = await requestUploadUrl({
        courseSlug: course.slug,
        dayNumber: s.dayNumber,
        kind: s.kind,
        fileName: s.file.name,
      });
      const put = await fetch(uploadUrl, {
        method: "PUT",
        body: s.file,
        headers: s.file.type ? { "Content-Type": s.file.type } : undefined,
      });
      if (!put.ok) {
        throw new Error(`Upload failed for ${s.file.name} (${put.status})`);
      }
      const durationMin =
        s.kind === "video" ? await probeDurationMin(s.file) : null;
      assets.push({
        dayNumber: s.dayNumber,
        kind: s.kind,
        key,
        fileName: s.file.name,
        contentType: s.file.type || null,
        sizeBytes: s.file.size,
        durationMin,
      });
    }

    // 2. One batched write: week meta + tasks + asset rows.
    await saveWeekEdits({
      courseSlug: course.slug,
      weekNumber: week.weekNumber,
      week: weekEdit ?? undefined,
      days: [],
      assets,
    });
    clearEdits();
    router.refresh();
  }

  function saveNow() {
    startTransition(flush);
  }

  /** Run `action`, but if there are unsaved edits, prompt to save/discard first. */
  function guard(action: () => void) {
    if (dirty) setPendingNav({ run: action });
    else action();
  }

  /** Stage a picked file (no upload yet — it goes up on Save). */
  function stageAsset(dayNumber: number, kind: AssetKind, file: File) {
    setAssetEdits((prev) => ({
      ...prev,
      [assetKey(dayNumber, kind)]: { dayNumber, kind, file },
    }));
  }

  /** Publish / unpublish a whole day (saved content only). */
  function togglePublish(dayNumber: number, publish: boolean) {
    startTransition(async () => {
      try {
        await setDayPublished({ courseSlug: course.slug, dayNumber, publish });
        toast.success(publish ? `Day ${dayNumber} published` : `Day ${dayNumber} unpublished`);
        router.refresh();
      } catch (error) {
        toast.error(`Couldn't ${publish ? "publish" : "unpublish"} day`, {
          description: error instanceof Error ? error.message : "Something went wrong",
        });
      }
    });
  }

  // Structural mutations (immediate — they change numbering, not staged text).
  function doAddWeek(title: string, focus: string) {
    startTransition(async () => {
      await createWeek(course.slug, title, focus);
      router.refresh();
      setSelected(weeks.length + 1);
    });
  }
  function doRemoveWeek() {
    startTransition(async () => {
      await removeWeek(course.slug, week.weekNumber);
      router.refresh();
    });
    setConfirmRemove(false);
  }

  const displayTitle = weekEdit?.title ?? week?.title ?? "";
  const displayFocus = weekEdit?.focus ?? week?.focus ?? "";

  return (
    <div className={dirty ? "pb-24" : undefined}>
      {/* Header */}
      <header className="flex flex-row items-center justify-between gap-4 border-b border-border pb-6">
        <div className="flex flex-col gap-0.5 min-w-0">
          <Link
            href="/admin/content-management"
            className="flex items-center gap-1 text-xs text-mute hover:text-ink"
          >
            <ChevronLeft className="size-3.5" />
            All courses
          </Link>
          <h1 className="truncate font-display text-xl sm:text-3xl font-extrabold tracking-tight text-ink">
            {course.title}
          </h1>
          <p className="truncate text-xs sm:text-sm text-body">
            {weeks.length} weeks · {teachingDayCount(weeks)} days
            {course.level ? ` · ${course.level}` : ""}
          </p>
        </div>

        <div className="flex items-center gap-2 sm:gap-4 shrink-0">
          <div className="text-right hidden sm:block">
            <div className="font-display text-lg sm:text-2xl font-extrabold text-ink leading-none">
              {stats.percent}%
            </div>
            <div className="text-[10px] sm:text-xs text-mute mt-1">
              {stats.published} / {stats.total} published
            </div>
          </div>
          <Button
            onClick={() => guard(() => setAddingWeek(true))}
            disabled={pending}
            className="h-9 sm:h-11 px-3 sm:px-6 text-xs sm:text-sm rounded-lg sm:rounded-xl"
          >
            <Plus />
            Add week
          </Button>
        </div>
      </header>

      {!week ? (
        /* Empty state — no weeks yet. Build the programme one week at a time. */
        <div className="mt-16 flex flex-col items-center gap-4 text-center">
          <p className="max-w-sm text-sm text-mute">
            No weeks yet. Add your first week to start building the programme —
            each week comes with {TEACHING_DAYS_PER_WEEK} empty teaching days you
            fill in with a video, notes, and a daily task.
          </p>
          <Button onClick={() => setAddingWeek(true)}>
            <Plus />
            Add week
          </Button>
        </div>
      ) : null}

      {/* Week rail — numbers only; the week's theme shows in the heading below. */}
      {week ? (
      <section className="mt-6" aria-label="Weeks">
        <div className="overflow-x-auto pb-1">
          <div className="inline-flex items-center gap-1 rounded-full bg-secondary p-1">
            {weeks.map((w) => (
              <WeekPill
                key={w.weekNumber}
                weekNumber={w.weekNumber}
                selected={w.weekNumber === clamped}
                unsaved={dirty && w.weekNumber === clamped}
                onSelect={() => guard(() => setSelected(w.weekNumber))}
              />
            ))}
          </div>
        </div>
      </section>
      ) : null}

      {/* Selected week */}
      {week ? (
      <section className="mt-6" aria-label={`Week ${week.weekNumber}`}>
        <div className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 flex-col gap-1">
            <h2 className="font-display text-xl font-extrabold tracking-tight text-ink">
              Week {week.weekNumber} · {displayTitle}
            </h2>
            <p className="text-sm text-body">{displayFocus}</p>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0"
                aria-label={`Week ${week.weekNumber} actions`}
              >
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setEditingWeek(true)}>
                <Pencil />
                Edit week
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => guard(() => setConfirmRemove(true))}
                disabled={weeks.length <= 1}
                className="text-destructive focus:bg-destructive/10 focus:text-destructive [&_svg]:text-destructive"
              >
                <Trash2 />
                Remove week
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Weekdays */}
        <div className="mt-5 flex flex-col gap-3">
          {week.days.map((day) => (
            <DayCard
              key={day.dayNumber}
              courseSlug={course.slug}
              day={day}
              stagedNotesName={
                assetEdits[assetKey(day.dayNumber, "notes")]?.file.name
              }
              onPickNotes={(file) => stageAsset(day.dayNumber, "notes", file)}
              pending={pending}
              onTogglePublish={(publish) => togglePublish(day.dayNumber, publish)}
            />
          ))}
        </div>

        {/* Weekend */}
        <div className="mt-8">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-semibold text-ink">Weekly Assessments</h3>
            <span className="text-xs text-mute">
              Assessments 1 & 2 ·
              not counted toward the {teachingDayCount(weeks)}-day path
            </span>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {week.quizzes.map((quiz) => (
              <QuizCard
                key={quiz.id}
                courseSlug={course.slug}
                quiz={quiz}
                weekNumber={week.weekNumber}
              />
            ))}
          </div>
        </div>
      </section>
      ) : null}

      {/* Floating save bar — only while there are unsaved edits. */}
      {week && dirty ? (
        <div className="fixed inset-x-0 bottom-6 z-40 flex justify-center px-4">
          <div className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-2 shadow-lg">
            <span className="px-2 text-sm font-medium text-ink">
              {editCount} unsaved {editCount === 1 ? "change" : "changes"}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearEdits}
              disabled={pending}
            >
              Discard
            </Button>
            <Button size="sm" onClick={saveNow} disabled={pending}>
              {pending ? <Loader2 className="animate-spin" /> : null}
              Save
            </Button>
          </div>
        </div>
      ) : null}

      {/* Add week (immediate) */}
      <WeekFormDialog
        key={addingWeek ? "add" : "add-closed"}
        open={addingWeek}
        pending={pending}
        week={null}
        onOpenChange={(open) => !open && setAddingWeek(false)}
        onSubmit={(title, focus) => {
          doAddWeek(title, focus);
          setAddingWeek(false);
        }}
      />

      {/* Edit week (staged) */}
      {week ? (
        <WeekFormDialog
          key={editingWeek ? `edit-${week.weekNumber}` : "edit-closed"}
          open={editingWeek}
          pending={pending}
          week={{ ...week, title: displayTitle, focus: displayFocus }}
          onOpenChange={(open) => !open && setEditingWeek(false)}
          onSubmit={(title, focus) => {
            setWeekEdit({ title, focus });
            setEditingWeek(false);
          }}
        />
      ) : null}

      {/* Remove week */}
      {week ? (
      <Dialog open={confirmRemove} onOpenChange={setConfirmRemove}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove week {week.weekNumber}?</DialogTitle>
            <DialogDescription>
              This deletes “{week.title}” along with its{" "}
              {TEACHING_DAYS_PER_WEEK} days, their uploaded files, and{" "}
              {QUIZZES_PER_WEEK} quizzes. The weeks after it move up, so later
              day numbers change.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary">
                Cancel
              </Button>
            </DialogClose>
            <Button
              type="button"
              variant="destructive"
              disabled={pending}
              onClick={doRemoveWeek}
            >
              <Trash2 />
              Remove week
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      ) : null}

      {/* Unsaved-changes guard */}
      {week ? (
      <Dialog
        open={pendingNav !== null}
        onOpenChange={(open) => !open && setPendingNav(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save your changes?</DialogTitle>
            <DialogDescription>
              You have {editCount} unsaved{" "}
              {editCount === 1 ? "change" : "changes"} on week {week.weekNumber}.
              Save before leaving, or discard to continue.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setPendingNav(null)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={pending}
              onClick={() => {
                const next = pendingNav;
                clearEdits();
                setPendingNav(null);
                next?.run();
              }}
            >
              Discard
            </Button>
            <Button
              type="button"
              disabled={pending}
              onClick={() => {
                const next = pendingNav;
                startTransition(async () => {
                  await flush();
                  next?.run();
                });
                setPendingNav(null);
              }}
            >
              {pending ? <Loader2 className="animate-spin" /> : null}
              Save & continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      ) : null}
    </div>
  );
}

/** Add-a-week and edit-a-week share one form; `week` null means "add". */
function WeekFormDialog({
  open,
  pending,
  onOpenChange,
  week,
  onSubmit,
}: {
  open: boolean;
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  week: CurriculumWeek | null;
  onSubmit: (title: string, focus: string) => void;
}) {
  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const title = String(form.get("title") ?? "").trim();
    const focus = String(form.get("focus") ?? "").trim();
    if (!title) return;
    onSubmit(title, focus);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{week ? "Edit week" : "Add week"}</DialogTitle>
          <DialogDescription>
            {week
              ? `Rename week ${week.weekNumber} or reword what it covers. Changes are saved with the Save bar.`
              : `A new week is appended with ${TEACHING_DAYS_PER_WEEK} empty days and ${QUIZZES_PER_WEEK} assessments.`}
          </DialogDescription>
        </DialogHeader>

        <form id="week-form" onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="week-title">Title</Label>
            <Input
              id="week-title"
              name="title"
              defaultValue={week?.title ?? ""}
              placeholder="Foundations"
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="week-focus">Description</Label>
            <Input
              id="week-focus"
              name="focus"
              defaultValue={week?.focus ?? ""}
              placeholder="What this week covers"
            />
          </div>
        </form>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary">
              Cancel
            </Button>
          </DialogClose>
          <Button type="submit" form="week-form" disabled={pending}>
            {week ? "Apply" : "Add week"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function WeekPill({
  weekNumber,
  selected,
  unsaved,
  onSelect,
}: {
  weekNumber: number;
  selected: boolean;
  unsaved: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={selected ? "true" : undefined}
      className={cn(
        "relative shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        selected ? "bg-card text-ink shadow-sm" : "text-body hover:text-ink",
      )}
    >
      Week {weekNumber}
      {unsaved ? (
        <span
          aria-hidden
          className="absolute right-1 top-1 size-1.5 rounded-full bg-warning"
        />
      ) : null}
    </button>
  );
}

function DayCard({
  courseSlug,
  day,
  stagedNotesName,
  onPickNotes,
  pending,
  onTogglePublish,
}: {
  courseSlug: string;
  day: CurriculumDay;
  stagedNotesName: string | undefined;
  onPickNotes: (file: File) => void;
  pending: boolean;
  onTogglePublish: (publish: boolean) => void;
}) {
  // A day is publishable once any slot has saved content. It reads as published
  // only when every slot that has content is published.
  const slots = [
    day.video.partCount > 0 ? day.video.status : null,
    day.notes.assetKey ? day.notes.status : null,
    day.task.questionCount > 0 ? day.task.status : null,
  ].filter((s): s is (typeof day.video.status) => s !== null);
  const hasContent = slots.length > 0;
  const published = hasContent && slots.every((s) => s === "published");

  return (
    <article className="rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary-pale text-sm font-extrabold text-ink-deep">
            {day.dayNumber}
          </span>
          <div>
            <div className="text-sm font-semibold text-ink">{day.title}</div>
            <div className="text-xs text-mute">
              Weekday {day.weekday} of {TEACHING_DAYS_PER_WEEK}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant={published ? "secondary" : "ghost"}
            size="sm"
            disabled={pending || !hasContent || Boolean(stagedNotesName)}
            title={
              stagedNotesName
                ? "Save the pending notes file before publishing"
                : hasContent
                  ? undefined
                  : "Add a video, notes, or task before publishing"
            }
            onClick={() => onTogglePublish(!published)}
          >
            {published ? <EyeOff /> : <Globe />}
            {published ? "Unpublish" : "Publish"}
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link
              href={`/admin/content-management/${courseSlug}/${day.dayNumber}`}
              aria-label={`View ${day.title}`}
            >
              <Eye />
              View
            </Link>
          </Button>
        </div>
      </div>

      <div className="divide-y divide-border">
        <div className="flex items-center gap-3 px-4 py-3">
          <Video className="size-4 shrink-0 text-mute" />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-ink">Video class</div>
            <div className="truncate text-xs text-mute">
              {day.video.partCount > 0
                ? `${day.video.partCount} ${day.video.partCount === 1 ? "part" : "parts"}${day.video.durationMin ? ` · ${day.video.durationMin} min` : ""}`
                : "No videos"}
            </div>
          </div>
          <Badge variant={STATUS_VARIANT[day.video.status]}>
            {STATUS_LABEL[day.video.status]}
          </Badge>
          <Button variant="ghost" size="sm" asChild>
            <Link
              href={`/admin/content-management/${courseSlug}/${day.dayNumber}?tab=videos`}
            >
              <Upload />
              Manage
            </Link>
          </Button>
        </div>

        <div className="flex items-center gap-3 px-4 py-3">
          <FileText className="size-4 shrink-0 text-mute" />
          <Link
            href={`/admin/content-management/${courseSlug}/${day.dayNumber}?tab=notes`}
            className="min-w-0 flex-1 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div className="flex items-center gap-2 text-sm font-medium text-ink">
              Notes
              {stagedNotesName ? (
                <span className="text-xs font-normal text-warning-deep">
                  Unsaved
                </span>
              ) : null}
            </div>
            <div className="truncate text-xs text-mute">
              {stagedNotesName
                ? stagedNotesName
                : day.notes.assetKey
                  ? (day.notes.fileName ?? "File attached")
                  : "No file"}
            </div>
          </Link>
          <Badge variant={STATUS_VARIANT[day.notes.status]}>
            {STATUS_LABEL[day.notes.status]}
          </Badge>
          <FilePickButton
            kind="notes"
            label={day.notes.assetKey || stagedNotesName ? "Replace" : "Upload"}
            onPick={onPickNotes}
          />
        </div>

        <div className="flex items-center gap-3 px-4 py-3">
          <ClipboardList className="size-4 shrink-0 text-mute" />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-ink">Daily task</div>
            <div className="truncate text-xs text-mute">
              {day.task.questionCount > 0
                ? `${day.task.questionCount} ${day.task.questionCount === 1 ? "question" : "questions"}`
                : "No questions"}
            </div>
          </div>
          <Badge variant={STATUS_VARIANT[day.task.status]}>
            {STATUS_LABEL[day.task.status]}
          </Badge>
          <Button variant="ghost" size="sm" asChild>
            <Link
              href={`/admin/content-management/${courseSlug}/${day.dayNumber}?tab=task`}
            >
              <Pencil />
              Manage
            </Link>
          </Button>
        </div>
      </div>
    </article>
  );
}

function QuizCard({
  courseSlug,
  quiz,
  weekNumber,
}: {
  courseSlug: string;
  quiz: WeekendQuiz;
  weekNumber: number;
}) {
  const href = `/admin/content-management/${courseSlug}/quiz/${weekNumber}/${quiz.day}`;
  return (
    <article className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-secondary">
            <ListChecks className="size-4.5 text-mute" />
          </span>
          <div>
            <div className="text-sm font-semibold text-ink">{quiz.title}</div>
            <div className="text-xs capitalize text-mute">
              {quiz.day === "saturday" ? "Assessment 1" : "Assessment 2"} · {quiz.kind}
            </div>
          </div>
        </div>
        <Badge variant={STATUS_VARIANT[quiz.status]}>
          {STATUS_LABEL[quiz.status]}
        </Badge>
      </div>

      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-mute">
          {quiz.questionCount > 0
            ? `${quiz.questionCount} questions`
            : "No questions yet"}
        </span>
        <Button variant="ghost" size="sm" asChild>
          <Link href={href}>
            <Pencil />
            {quiz.questionCount > 0 ? "Edit quiz" : "Build quiz"}
          </Link>
        </Button>
      </div>
    </article>
  );
}
