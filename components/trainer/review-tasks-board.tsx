"use client";

import * as React from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DirectoryFilters,
  DirectoryToolbar,
  SearchField,
  TAB_PANEL_CLASS,
} from "@/components/admin/directory-toolbar";
import { TaskReviewList } from "@/components/trainer/task-review-list";
import {
  GradingPanel,
  GradingPanelEmpty,
} from "@/components/trainer/grading-panel";
import {
  slaLevel,
  type ReviewStatus,
  type Submission,
} from "@/lib/tasks/review";

// Trainer > Review Tasks — day-to-day grading for every assigned student.
//
// Master–detail: the queue on the left, the submission being graded on the
// right. Grading advances to the next pending item so a trainer can work the
// whole queue without going back to the list.
//
// Renders inside the (dashboard) shell, which already supplies <main>, the
// max-width and the page padding — so this is a plain block, not a page frame.

type QueueTab = "pending" | "reviewed" | "all";

export function ReviewTasksBoard({
  initialSubmissions = [],
}: {
  initialSubmissions?: Submission[];
}) {
  const [submissions, setSubmissions] = React.useState<Submission[]>(initialSubmissions);
  const [tab, setTab] = React.useState<QueueTab>("pending");
  const [query, setQuery] = React.useState("");
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  // Longest-waiting first inside each tab — that is the order the SLA cares
  // about, and it keeps the top of the list the right thing to open next.
  const visible = React.useMemo(() => {
    const q = query.trim().toLowerCase();

    return submissions
      .filter((s) => {
        if (tab === "pending" && s.status !== "pending") return false;
        if (tab === "reviewed" && s.status === "pending") return false;
        if (!q) return true;
        return (
          s.studentName.toLowerCase().includes(q) ||
          s.studentEmail.toLowerCase().includes(q) ||
          s.taskTitle.toLowerCase().includes(q) ||
          `day ${s.dayNumber}`.includes(q)
        );
      })
      .sort((a, b) => b.hoursWaiting - a.hoursWaiting);
  }, [submissions, tab, query]);

  // Keep a valid selection as the filters change: fall back to the top row.
  const selected = visible.find((s) => s.id === selectedId) ?? visible[0] ?? null;

  const pendingCount = submissions.filter((s) => s.status === "pending").length;
  const overdueCount = submissions.filter(
    (s) => s.status === "pending" && slaLevel(s) === "overdue",
  ).length;

  function handleGrade(
    id: string,
    result: { status: ReviewStatus; score: number; feedback: string },
  ) {
    // The next item to open, picked before the graded one leaves the Pending
    // tab — afterwards it is no longer in `visible` to take a position from.
    const queue = visible.filter((s) => s.status === "pending" && s.id !== id);
    const next = queue[0] ?? null;

    setSubmissions((prev) =>
      prev.map((s) =>
        s.id === id
          ? { ...s, ...result, hoursWaiting: 0 }
          : s,
      ),
    );
    setSelectedId(tab === "pending" ? next?.id ?? null : id);
  }

  return (
    <div>
      {/* Header */}
      <header className="flex flex-col gap-5 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1.5">
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink">
            Review tasks
          </h1>
          <p className="text-sm text-body">
            {pendingCount} awaiting your feedback
            {overdueCount > 0 && ` · ${overdueCount} past the 48-hour promise`}
          </p>
        </div>
      </header>

      <Tabs
        value={tab}
        onValueChange={(value) => setTab(value as QueueTab)}
        className="mt-6"
      >
        <DirectoryToolbar>
          <TabsList>
            <TabsTrigger value="pending">Pending</TabsTrigger>
            <TabsTrigger value="reviewed">Reviewed</TabsTrigger>
            <TabsTrigger value="all">All</TabsTrigger>
          </TabsList>

          <DirectoryFilters>
            <SearchField
              value={query}
              onChange={setQuery}
              placeholder="Search student, task or day"
              label="Search submissions"
            />
          </DirectoryFilters>
        </DirectoryToolbar>

      </Tabs>

      {/* All three tabs render the same split — only the filter differs, so the
          panel lives here once rather than inside three identical TabsContent
          blocks (which would also remount the grading form on every switch). */}
      <div
        className={`${TAB_PANEL_CLASS} grid gap-6 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]`}
      >
        <TaskReviewList
          submissions={visible}
          selectedId={selected?.id ?? null}
          onSelect={setSelectedId}
        />

        {selected ? (
          <GradingPanel
            key={selected.id}
            submission={selected}
            onGrade={(result) => handleGrade(selected.id, result)}
          />
        ) : (
          <GradingPanelEmpty
            message={
              tab === "pending"
                ? "The queue is clear. Every task has feedback."
                : "Pick a submission from the list to see it here."
            }
          />
        )}
      </div>
    </div>
  );
}
