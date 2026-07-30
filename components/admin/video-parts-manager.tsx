"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  Eye,
  EyeOff,
  ImagePlus,
  Loader2,
  Plus,
  Trash2,
  Upload,
  Video,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import {
  addVideoPart,
  deleteVideoPart,
  moveVideoPart,
  removeVideoPartThumbnail,
  replaceVideoPart,
  requestThumbnailUploadUrl,
  requestUploadUrl,
  setVideoPartStatus,
  setVideoPartThumbnail,
  updateVideoPart,
} from "@/lib/content/actions";
import { STATUS_LABEL, STATUS_VARIANT } from "@/lib/content/status";
import type { VideoPart } from "@/types/content";

// Admin > Content > Day — the video parts of a class. A day can have any number
// of ordered parts; each uploads straight to R2 and can be published, replaced,
// reordered or removed independently.

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

/** Upload a video file to R2, returning its key + probed duration. */
async function uploadVideo(dayNumber: number, file: File) {
  const { key, uploadUrl } = await requestUploadUrl({
    dayNumber,
    kind: "video",
    fileName: file.name,
  });
  const put = await fetch(uploadUrl, {
    method: "PUT",
    body: file,
    headers: file.type ? { "Content-Type": file.type } : undefined,
  });
  if (!put.ok) throw new Error(`Upload failed (${put.status})`);
  const durationMin = await probeDurationMin(file);
  return { key, durationMin };
}

export function VideoPartsManager({
  dayNumber,
  parts,
  videoUrls,
  thumbnailUrls,
}: {
  dayNumber: number;
  parts: VideoPart[];
  videoUrls: Record<string, string>;
  thumbnailUrls: Record<string, string>;
}) {
  return (
    <article className="rounded-xl border border-border">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <Video className="size-4 shrink-0 text-mute" />
          <div className="min-w-0">
            <div className="text-sm font-semibold text-ink">Video class</div>
            <div className="text-xs text-mute">
              {parts.length} {parts.length === 1 ? "part" : "parts"}
            </div>
          </div>
        </div>
        <AddPartButton dayNumber={dayNumber} />
      </div>

      <div className="flex flex-col gap-3 p-4">
        {parts.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-mute">
            No videos yet. Add the first part of the class.
          </div>
        ) : (
          parts.map((part, i) => (
            <PartRow
              key={part.id}
              part={part}
              index={i}
              total={parts.length}
              dayNumber={dayNumber}
              url={videoUrls[part.id] ?? null}
              thumbnailUrl={thumbnailUrls[part.id] ?? null}
            />
          ))
        )}
      </div>
    </article>
  );
}

function AddPartButton({ dayNumber }: { dayNumber: number }) {
  const router = useRouter();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState(false);

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      const { key, durationMin } = await uploadVideo(dayNumber, file);
      await addVideoPart({
        dayNumber,
        key,
        fileName: file.name,
        contentType: file.type || null,
        sizeBytes: file.size,
        durationMin,
      });
      toast.success("Video part added");
      router.refresh();
    } catch (e) {
      toast.error("Couldn't add part", {
        description: e instanceof Error ? e.message : "Upload failed",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="video/*"
        className="sr-only"
        onChange={handleFile}
        disabled={busy}
      />
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
      >
        {busy ? <Loader2 className="animate-spin" /> : <Plus />}
        {busy ? "Uploading…" : "Add part"}
      </Button>
    </>
  );
}

function PartRow({
  part,
  index,
  total,
  dayNumber,
  url,
  thumbnailUrl,
}: {
  part: VideoPart;
  index: number;
  total: number;
  dayNumber: number;
  url: string | null;
  thumbnailUrl: string | null;
}) {
  const router = useRouter();
  const replaceRef = React.useRef<HTMLInputElement>(null);
  const thumbRef = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState(false);
  const [title, setTitle] = React.useState(part.title ?? "");
  const [description, setDescription] = React.useState(part.description ?? "");
  const detailsDirty =
    title !== (part.title ?? "") || description !== (part.description ?? "");

  async function run(label: string, action: () => Promise<void>) {
    setBusy(true);
    try {
      await action();
      router.refresh();
    } catch (e) {
      toast.error(label, {
        description: e instanceof Error ? e.message : "Something went wrong",
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleReplace(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    await run("Couldn't replace video", async () => {
      const { key, durationMin } = await uploadVideo(dayNumber, file);
      await replaceVideoPart({
        dayNumber,
        id: part.id,
        key,
        fileName: file.name,
        contentType: file.type || null,
        sizeBytes: file.size,
        durationMin,
      });
      toast.success("Video replaced");
    });
  }

  async function handleThumbnail(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    await run("Couldn't set thumbnail", async () => {
      const { key, uploadUrl } = await requestThumbnailUploadUrl({
        dayNumber,
        fileName: file.name,
      });
      const put = await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: file.type ? { "Content-Type": file.type } : undefined,
      });
      if (!put.ok) throw new Error(`Upload failed (${put.status})`);
      await setVideoPartThumbnail({ dayNumber, id: part.id, key });
      toast.success("Thumbnail set");
    });
  }

  const published = part.status === "published";

  return (
    <div className="rounded-lg border border-border p-3">
      <div className="flex flex-col gap-3 sm:flex-row">
        {url ? (
          <video
            controls
            preload="metadata"
            src={url}
            className="aspect-video w-full rounded-lg bg-black sm:w-64"
          />
        ) : (
          <div className="grid aspect-video w-full place-items-center rounded-lg bg-secondary text-xs text-mute sm:w-64">
            Configure R2 to preview
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-sm font-semibold text-ink">
              {part.title || `Part ${part.position}`}
            </span>
            <Badge variant={STATUS_VARIANT[part.status]}>
              {STATUS_LABEL[part.status]}
            </Badge>
          </div>
          <div className="text-xs text-mute">
            {part.fileName ?? "Uploaded"}
            {part.durationMin ? ` · ${part.durationMin} min` : ""}
          </div>

          <div className="mt-auto flex flex-wrap items-center gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              disabled={busy || index === 0}
              onClick={() =>
                run("Couldn't reorder", () =>
                  moveVideoPart({ dayNumber, id: part.id, direction: "up" }),
                )
              }
              aria-label="Move up"
            >
              <ArrowUp />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={busy || index === total - 1}
              onClick={() =>
                run("Couldn't reorder", () =>
                  moveVideoPart({ dayNumber, id: part.id, direction: "down" }),
                )
              }
              aria-label="Move down"
            >
              <ArrowDown />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() =>
                run("Couldn't update", () =>
                  setVideoPartStatus({
                    dayNumber,
                    id: part.id,
                    status: published ? "draft" : "published",
                  }),
                )
              }
            >
              {published ? <EyeOff /> : <Eye />}
              {published ? "Unpublish" : "Publish"}
            </Button>
            <input
              ref={replaceRef}
              type="file"
              accept="video/*"
              className="sr-only"
              onChange={handleReplace}
              disabled={busy}
            />
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => replaceRef.current?.click()}
            >
              <Upload />
              Replace
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              className="text-destructive hover:text-destructive"
              onClick={() =>
                run("Couldn't delete", async () => {
                  await deleteVideoPart({ dayNumber, id: part.id });
                  toast.success("Video part removed");
                })
              }
              aria-label="Delete part"
            >
              {busy ? <Loader2 className="animate-spin" /> : <Trash2 />}
            </Button>
          </div>
        </div>
      </div>

      {/* Context students see instead of "Part N". */}
      <div className="mt-3 grid gap-2 border-t border-border pt-3">
        <div className="grid gap-1.5">
          <Label htmlFor={`title-${part.id}`} className="text-xs text-mute">
            Title
          </Label>
          <Input
            id={`title-${part.id}`}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={`Part ${part.position}`}
            disabled={busy}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`desc-${part.id}`} className="text-xs text-mute">
            Description
          </Label>
          <Textarea
            id={`desc-${part.id}`}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="Short context for students…"
            disabled={busy}
          />
        </div>

        {/* Thumbnail */}
        <div className="grid gap-1.5">
          <span className="text-xs text-mute">Thumbnail</span>
          <div className="flex items-center gap-3">
            {thumbnailUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={thumbnailUrl}
                alt=""
                className="aspect-video w-28 shrink-0 rounded-lg border border-border object-cover"
              />
            ) : (
              <span className="grid aspect-video w-28 shrink-0 place-items-center rounded-lg border border-dashed border-border text-mute">
                <ImagePlus className="size-5" />
              </span>
            )}
            <input
              ref={thumbRef}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={handleThumbnail}
              disabled={busy}
            />
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => thumbRef.current?.click()}
            >
              <ImagePlus />
              {part.thumbnailKey ? "Change" : "Add thumbnail"}
            </Button>
            {part.thumbnailKey ? (
              <Button
                variant="ghost"
                size="sm"
                disabled={busy}
                className="text-destructive hover:text-destructive"
                onClick={() =>
                  run("Couldn't remove thumbnail", async () => {
                    await removeVideoPartThumbnail({ dayNumber, id: part.id });
                    toast.success("Thumbnail removed");
                  })
                }
              >
                <X />
                Remove
              </Button>
            ) : null}
          </div>
        </div>

        <div className="flex justify-end">
          <Button
            variant="secondary"
            size="sm"
            disabled={busy || !detailsDirty}
            onClick={() =>
              run("Couldn't save details", async () => {
                await updateVideoPart({
                  dayNumber,
                  id: part.id,
                  title,
                  description,
                });
                toast.success("Details saved");
              })
            }
          >
            Save details
          </Button>
        </div>
      </div>
    </div>
  );
}
