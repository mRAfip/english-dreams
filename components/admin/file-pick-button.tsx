"use client";

import * as React from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AssetKind } from "@/lib/r2/keys";

// Stage-only file picker. Picking a file does NOT upload — it hands the File to
// the parent, which holds it until the Save bar flushes everything to R2 in one
// batch. (The immediate-upload variant is AssetUploadButton, used on day-detail.)

const ACCEPT: Record<AssetKind, string> = {
  video: "video/*",
  notes: ".pdf,.doc,.docx,application/pdf",
};

export function FilePickButton({
  kind,
  label,
  onPick,
}: {
  kind: AssetKind;
  label: string;
  onPick: (file: File) => void;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT[kind]}
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = ""; // allow re-picking the same file
          if (file) onPick(file);
        }}
      />
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => inputRef.current?.click()}
      >
        <Upload />
        {label}
      </Button>
    </>
  );
}
