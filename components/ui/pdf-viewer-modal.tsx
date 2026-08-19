"use client";

import * as React from "react";
import { Download, ExternalLink, FileText, Loader2, Maximize2, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface PdfViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  viewUrl: string;
  downloadUrl?: string | null;
  fileName?: string | null;
}

export function PdfViewerModal({
  isOpen,
  onClose,
  title,
  viewUrl,
  downloadUrl,
  fileName,
}: PdfViewerModalProps) {
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (isOpen) {
      setLoading(true);
    }
  }, [isOpen, viewUrl]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex flex-col h-[92dvh] max-h-[92dvh] sm:h-[85vh] sm:max-h-[850px] w-[96vw] sm:w-[90vw] max-w-5xl p-0 gap-0 overflow-hidden rounded-xl sm:rounded-2xl border border-border bg-card shadow-2xl">
        {/* Header Bar */}
        <DialogHeader className="flex flex-row items-center justify-between border-b border-border px-3 py-2.5 sm:px-6 sm:py-3 bg-muted/40 shrink-0 z-20">
          <div className="flex items-center gap-2.5 overflow-hidden pr-2">
            <div className="grid size-8 sm:size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
              <FileText className="size-4 sm:size-5" />
            </div>
            <div className="flex flex-col min-w-0">
              <DialogTitle className="text-sm sm:text-base font-bold text-ink truncate">
                {title}
              </DialogTitle>
              {fileName ? (
                <span className="text-[11px] sm:text-xs text-mute truncate font-medium">
                  {fileName}
                </span>
              ) : null}
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {downloadUrl ? (
              <Button variant="outline" size="sm" asChild className="h-8 text-xs px-2.5 gap-1.5">
                <a href={downloadUrl} download>
                  <Download className="size-3.5" />
                  <span className="hidden sm:inline">Download</span>
                </a>
              </Button>
            ) : null}

            <Button variant="ghost" size="sm" asChild className="h-8 text-xs px-2.5 gap-1.5 text-mute hover:text-ink">
              <a href={viewUrl} target="_blank" rel="noopener noreferrer" title="Open in new window">
                <ExternalLink className="size-3.5" />
                <span className="hidden md:inline">Open tab</span>
              </a>
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="size-8 rounded-full text-mute hover:text-ink"
              aria-label="Close modal"
            >
              <X className="size-4" />
            </Button>
          </div>
        </DialogHeader>

        {/* Content Viewer Area — Scrollable Horizontally & Vertically for Mobile */}
        <div className="relative flex-1 w-full h-full overflow-auto bg-neutral-900/5 touch-pan-x touch-pan-y">
          {loading && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-card/80 backdrop-blur-xs text-mute">
              <Loader2 className="size-6 animate-spin text-primary" />
              <span className="text-xs font-medium">Loading document...</span>
            </div>
          )}

          {/* Wrapper with minimum width ensures document pages (A4/Word/PDF) are scrollable side-to-side on small mobile devices without clipping text */}
          <div className="w-full h-full min-w-[320px] sm:min-w-full">
            <iframe
              src={viewUrl}
              onLoad={() => setLoading(false)}
              className="h-full w-full border-0 min-h-[500px]"
              title={title}
            />
          </div>
        </div>

        {/* Mobile Action Footer Bar */}
        <div className="flex items-center justify-between border-t border-border bg-card px-3 py-2 text-xs text-mute shrink-0 sm:hidden z-20">
          <span className="truncate text-[11px]">Swipe horizontally if text is wider</span>
          <div className="flex items-center gap-2 shrink-0">
            {downloadUrl ? (
              <a
                href={downloadUrl}
                download
                className="font-semibold text-primary underline text-[11px]"
              >
                Download PDF
              </a>
            ) : (
              <a
                href={viewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-primary underline text-[11px]"
              >
                Open Fullscreen
              </a>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
