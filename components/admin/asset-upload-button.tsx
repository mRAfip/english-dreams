"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Upload, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { requestUploadUrl, saveAsset } from "@/lib/content/actions";
import type { AssetKind } from "@/lib/r2/keys";

// Direct-to-R2 upload from the browser: ask the server for a presigned PUT URL,
// PUT the file straight to R2 (so large videos never pass through Next), then
// record the object in the DB. Used for both video classes and notes.

const ACCEPT: Record<AssetKind, string> = {
  video: "video/*",
  notes: ".pdf,.doc,.docx,application/pdf",
};

/** Read a video file's duration (minutes) in the browser. Null if unreadable. */
function probeDurationMin(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      const seconds = video.duration;
      resolve(Number.isFinite(seconds) ? Math.max(1, Math.round(seconds / 60)) : null);
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    video.src = url;
  });
}

export function AssetUploadButton({
  dayNumber,
  kind,
  label,
  icon: Icon = Upload,
  size = "sm",
  variant = "ghost",
}: {
  dayNumber: number;
  kind: AssetKind;
  label: string;
  icon?: LucideIcon;
  size?: "sm" | "default" | "icon";
  variant?: "ghost" | "secondary" | "tertiary" | "primary" | "outline";
}) {
  const router = useRouter();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ""; // allow re-picking the same file after an error
    if (!file) return;

    setBusy(true);
    setError(null);
    try {
      const { key, uploadUrl } = await requestUploadUrl({
        dayNumber,
        kind,
        fileName: file.name,
      });

      const put = await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: file.type ? { "Content-Type": file.type } : undefined,
      });
      if (!put.ok) {
        throw new Error(`Upload failed (${put.status})`);
      }

      const durationMin = kind === "video" ? await probeDurationMin(file) : null;

      await saveAsset({
        dayNumber,
        kind,
        key,
        fileName: file.name,
        contentType: file.type || null,
        sizeBytes: file.size,
        durationMin,
      });

      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT[kind]}
        className="sr-only"
        onChange={handleFile}
        disabled={busy}
      />
      <Button
        type="button"
        variant={variant}
        size={size}
        disabled={busy}
        onClick={() => inputRef.current?.click()}
      >
        {busy ? <Loader2 className="animate-spin" /> : <Icon />}
        {busy ? "Uploading…" : label}
      </Button>
      {error ? (
        <span className="max-w-48 text-right text-xs text-destructive">
          {error}
        </span>
      ) : null}
    </div>
  );
}
