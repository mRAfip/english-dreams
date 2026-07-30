import type { ContentStatus } from "@/types/content";

// How a ContentStatus presents in the admin UI. Shared so the week overview and
// the day detail page can't drift apart on wording or colour.

export const STATUS_LABEL: Record<ContentStatus, string> = {
  published: "Published",
  draft: "Draft",
  empty: "Not started",
};

export const STATUS_VARIANT: Record<
  ContentStatus,
  "positive" | "warning" | "outline"
> = {
  published: "positive",
  draft: "warning",
  empty: "outline",
};
