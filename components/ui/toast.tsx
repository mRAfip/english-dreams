"use client";

import * as React from "react";
import { CheckCircle2, Info, X, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

// shadcn-style toasts, self-contained (no Radix/sonner dependency). A tiny
// module-level store lets `toast()` be called from anywhere; <Toaster/> (mounted
// once in the root layout) subscribes and renders. Styled with design tokens.

type ToastVariant = "default" | "success" | "error";

type ToastRecord = {
  id: number;
  title: string;
  description?: string;
  variant: ToastVariant;
  duration: number;
};

let counter = 0;
let records: ToastRecord[] = [];
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return records;
}

function dismiss(id: number) {
  records = records.filter((r) => r.id !== id);
  emit();
}

type ToastOptions = { description?: string; duration?: number };

function push(title: string, variant: ToastVariant, opts?: ToastOptions): number {
  const id = ++counter;
  records = [
    ...records,
    {
      id,
      title,
      description: opts?.description,
      variant,
      duration: opts?.duration ?? 4000,
    },
  ];
  emit();
  return id;
}

/** Fire a toast. Use `toast.success` / `toast.error` for the common variants. */
export const toast = Object.assign(
  (title: string, opts?: ToastOptions) => push(title, "default", opts),
  {
    success: (title: string, opts?: ToastOptions) => push(title, "success", opts),
    error: (title: string, opts?: ToastOptions) => push(title, "error", opts),
    dismiss,
  },
);

const ICON: Record<ToastVariant, typeof Info> = {
  default: Info,
  success: CheckCircle2,
  error: XCircle,
};

const ACCENT: Record<ToastVariant, string> = {
  default: "text-body",
  success: "text-positive-deep",
  error: "text-destructive",
};

export function Toaster() {
  const items = React.useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  if (items.length === 0) return null;

  return (
    <div
      role="region"
      aria-label="Notifications"
      className="pointer-events-none fixed inset-x-4 bottom-4 z-100 flex flex-col items-center gap-2 sm:inset-x-auto sm:right-4 sm:items-end"
    >
      {items.map((item) => (
        <ToastCard key={item.id} record={item} />
      ))}
    </div>
  );
}

function ToastCard({ record }: { record: ToastRecord }) {
  const Icon = ICON[record.variant];

  React.useEffect(() => {
    const timer = setTimeout(() => dismiss(record.id), record.duration);
    return () => clearTimeout(timer);
  }, [record.id, record.duration]);

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border border-border bg-popover px-4 py-3 shadow-lg"
    >
      <Icon className={cn("mt-0.5 size-5 shrink-0", ACCENT[record.variant])} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-ink">{record.title}</p>
        {record.description ? (
          <p className="mt-0.5 text-sm text-body">{record.description}</p>
        ) : null}
      </div>
      <button
        type="button"
        onClick={() => dismiss(record.id)}
        aria-label="Dismiss"
        className="-mr-1 -mt-0.5 shrink-0 rounded-md p-1 text-mute transition-colors hover:text-ink"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
