"use client";

import * as React from "react";
import { Image as ImageIcon, Loader2, Trash2, Upload, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  requestBrandingBannerUploadUrl,
  saveBrandingBanner,
  removeBrandingBanner,
} from "@/lib/branding/actions";

interface BrandingManagerProps {
  initialBanner: {
    banner_key: string;
    banner_url: string;
  } | null;
}

export function BrandingManager({ initialBanner }: BrandingManagerProps) {
  const [banner, setBanner] = React.useState(initialBanner);
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [isUploading, setIsUploading] = React.useState(false);
  const [isRemoving, setIsRemoving] = React.useState(false);
  const [message, setMessage] = React.useState<{ type: "success" | "error"; text: string } | null>(null);

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Handle file selection
  const handleFileChange = (file: File) => {
    if (!file.type.startsWith("image/")) {
      setMessage({ type: "error", text: "Please select an image file (PNG, JPG, WebP)." });
      return;
    }
    // Limit to 5MB
    if (file.size > 5 * 1024 * 1024) {
      setMessage({ type: "error", text: "Image must be less than 5MB." });
      return;
    }

    setSelectedFile(file);
    setMessage(null);

    // Create a local preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileChange(file);
    }
  };

  // Upload to R2 & Save to Supabase
  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    setMessage(null);

    try {
      // 1. Get presigned upload URL
      const { key, uploadUrl } = await requestBrandingBannerUploadUrl({
        fileName: selectedFile.name,
      });

      // 2. PUT file directly to R2
      const res = await fetch(uploadUrl, {
        method: "PUT",
        body: selectedFile,
        headers: {
          "Content-Type": selectedFile.type,
        },
      });

      if (!res.ok) {
        throw new Error(`Failed to upload image to storage (${res.status})`);
      }

      // 3. Save R2 key in Supabase
      const saveRes = await saveBrandingBanner({ key });
      if (!saveRes.ok) {
        throw new Error(saveRes.error || "Failed to save banner details.");
      }

      setBanner({
        banner_key: key,
        banner_url: saveRes.bannerUrl || `/api/branding/banner?v=${Date.now()}`,
      });
      setSelectedFile(null);
      setPreviewUrl(null);
      setMessage({ type: "success", text: "Branding banner updated successfully!" });
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "An unexpected error occurred." });
    } finally {
      setIsUploading(false);
    }
  };

  // Remove active banner
  const handleRemove = async () => {
    if (!confirm("Are you sure you want to remove the branding banner?")) return;

    setIsRemoving(true);
    setMessage(null);

    try {
      const res = await removeBrandingBanner();
      if (!res.ok) {
        throw new Error(res.error || "Failed to remove banner.");
      }
      setBanner(null);
      setSelectedFile(null);
      setPreviewUrl(null);
      setMessage({ type: "success", text: "Branding banner removed." });
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "An unexpected error occurred." });
    } finally {
      setIsRemoving(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Overview/Header */}
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink">
          Branding Settings
        </h1>
        <p className="text-sm text-mute">
          Manage visual brand elements across student dashboards.
        </p>
      </div>

      {/* Banner Upload Section */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Left: Upload Form */}
        <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-6 shadow-sm">
          <h2 className="font-display text-lg font-bold text-ink">
            Promotional Banner
          </h2>
          <p className="text-xs text-mute -mt-2">
            Upload an image to display at the top of the student dashboard. Recommended ratio: 16:9 or banner layout. Max size: 5MB.
          </p>

          {/* Drag & Drop Area */}
          <div
            onDragOver={onDragOver}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center justify-center border-2 border-dashed border-border hover:border-primary/50 rounded-lg p-8 cursor-pointer transition-colors text-mute hover:text-ink min-h-48"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileChange(file);
              }}
            />

            <Upload className="size-8 mb-3 text-mute/60" />
            <p className="text-sm font-semibold">
              Click to upload or drag & drop
            </p>
            <p className="text-xs text-mute mt-1">PNG, JPG or WebP up to 5MB</p>
          </div>

          {/* Selected File Details */}
          {selectedFile && (
            <div className="flex items-center justify-between p-3 border border-border rounded-lg bg-muted/30 text-sm">
              <div className="flex items-center gap-2 truncate">
                <ImageIcon className="size-4 shrink-0 text-primary" />
                <span className="truncate font-medium">{selectedFile.name}</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-red-500 hover:text-red-600 px-2 h-8"
                onClick={() => {
                  setSelectedFile(null);
                  setPreviewUrl(null);
                }}
              >
                Clear
              </Button>
            </div>
          )}

          {/* Messages */}
          {message && (
            <div
              className={`flex items-start gap-2.5 p-3.5 rounded-lg border text-sm ${
                message.type === "success"
                  ? "bg-green-500/5 text-green-700 border-green-500/20"
                  : "bg-red-500/5 text-red-700 border-red-500/20"
              }`}
            >
              {message.type === "success" ? (
                <CheckCircle2 className="size-4 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="size-4 shrink-0 mt-0.5" />
              )}
              <span>{message.text}</span>
            </div>
          )}

          {/* Upload Button */}
          {selectedFile && (
            <Button
              onClick={handleUpload}
              disabled={isUploading}
              className="w-full bg-primary text-white"
            >
              {isUploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                "Save & Publish Banner"
              )}
            </Button>
          )}
        </div>

        {/* Right: Live Preview */}
        <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold text-ink">
              Preview
            </h2>
            {banner && (
              <Button
                variant="ghost"
                size="sm"
                className="text-red-500 hover:text-red-600"
                onClick={handleRemove}
                disabled={isRemoving}
              >
                {isRemoving ? (
                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="mr-2 h-3.5 w-3.5" />
                )}
                Remove
              </Button>
            )}
          </div>

          <div className="relative flex-1 min-h-48 border border-border rounded-lg overflow-hidden bg-muted/20 flex items-center justify-center">
            {previewUrl ? (
              <div className="relative w-full h-full min-h-48">
                <img
                  src={previewUrl}
                  alt="Banner preview"
                  className="absolute inset-0 w-full h-full object-cover"
                />
                <span className="absolute top-2 left-2 bg-primary/90 text-white text-[10px] uppercase font-bold px-2 py-0.5 rounded-full shadow-sm">
                  Unsaved Preview
                </span>
              </div>
            ) : banner ? (
              <div className="relative w-full h-full min-h-48">
                <img
                  src={banner.banner_url}
                  alt="Active banner"
                  className="absolute inset-0 w-full h-full object-cover"
                />
                <span className="absolute top-2 left-2 bg-green-600/90 text-white text-[10px] uppercase font-bold px-2 py-0.5 rounded-full shadow-sm">
                  Live Banner
                </span>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-6 text-center text-mute">
                <ImageIcon className="size-10 mb-2 opacity-40" />
                <p className="text-sm font-semibold">No active banner</p>
                <p className="text-xs max-w-xs mt-1">
                  Upload an image on the left to display a banner on student dashboards.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
