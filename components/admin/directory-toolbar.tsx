"use client";

import * as React from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

// The strip that sits between an admin page header and its table: tabs on the
// left, search (plus any extra filter) on the right. Shared by Students,
// Trainers and Leaderboard so the controls land in the same place on every
// screen — they drifted to three different breakpoints when each page owned its
// own copy.
//
// Usage — always inside <Tabs>, so the list and the panels share its state:
//
//   <Tabs defaultValue="active" className="mt-6">
//     <DirectoryToolbar>
//       <TabsList>...</TabsList>
//       <DirectoryFilters>
//         <SearchField ... />
//       </DirectoryFilters>
//     </DirectoryToolbar>
//     <TabsContent value="active" className={TAB_PANEL_CLASS}>...</TabsContent>
//   </Tabs>

/** Gap between the toolbar and the panel below it. */
export const TAB_PANEL_CLASS = "mt-5";

export function DirectoryToolbar({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      {children}
    </div>
  );
}

/** Right-hand cluster. Stacks below the tabs on mobile, inline from `sm`. */
export function DirectoryFilters({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      {children}
    </div>
  );
}

export function SearchField({
  value,
  onChange,
  placeholder,
  label,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  /** Accessible name — the field has no visible label. */
  label: string;
  className?: string;
}) {
  return (
    <div className={cn("relative sm:w-64", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-mute" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
        className="h-10 pl-9"
      />
    </div>
  );
}
