"use client";

import * as React from "react";
import { AlertTriangle, CalendarCheck, ClipboardCheck, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DirectoryFilters,
  DirectoryToolbar,
  SearchField,
  TAB_PANEL_CLASS,
} from "@/components/admin/directory-toolbar";
import {
  attentionReason,
  DAY_STATE,
  initials,
  TEACHING_DAYS_PER_WEEK,
  TOTAL_DAYS,
  type AssignedStudent,
  type DayState,
} from "@/lib/trainer/roster";
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// Trainer > Assigned Students — the roster a trainer works from.
//
// One table, nothing else. Every column answers a question the trainer asks
// before opening anyone's work: how far are they, did they turn up this week,
// how are they scoring, and is anything sitting in my queue.
//
// Renders inside the (dashboard) shell, which already supplies <main>, the
// max-width and the page padding — so this is a plain block, not a page frame.
//
// The roster is loaded server-side (lib/trainer/assigned) from the assignment,
// progress and quiz-attempt tables, and passed in.

export function AssignedStudentsTable({
  students,
}: {
  students: AssignedStudent[];
}) {
  const [query, setQuery] = React.useState("");

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return students;
    return students.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q),
    );
  }, [query, students]);

  const attention = filtered.filter((s) => attentionReason(s) !== null);
  const onTrack = filtered.filter((s) => attentionReason(s) === null);
  const pendingTotal = students.reduce((sum, s) => sum + s.pendingReview, 0);

  return (
    <div>
      {/* Header */}
      <header className="flex flex-col gap-5 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1.5">
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink">
            Assigned students
          </h1>
          <p className="text-sm text-body">
            {students.length} students in your care · {pendingTotal} tasks
            waiting on you
          </p>
        </div>
      </header>

      {/* Roster */}
      <Tabs defaultValue="all" className="mt-6">
        <DirectoryToolbar>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="attention">Needs attention</TabsTrigger>
            <TabsTrigger value="on-track">On track</TabsTrigger>
          </TabsList>

          <DirectoryFilters>
            <SearchField
              value={query}
              onChange={setQuery}
              placeholder="Search students"
              label="Search assigned students"
            />
          </DirectoryFilters>
        </DirectoryToolbar>

        <TabsContent value="all" className={TAB_PANEL_CLASS}>
          <RosterTable
            students={filtered}
            empty={
              students.length === 0
                ? "No students are assigned to you yet. An admin assigns students to trainers."
                : "No students match that search."
            }
          />
        </TabsContent>
        <TabsContent value="attention" className={TAB_PANEL_CLASS}>
          <RosterTable students={attention} empty="Nobody is falling behind." />
        </TabsContent>
        <TabsContent value="on-track" className={TAB_PANEL_CLASS}>
          <RosterTable students={onTrack} />
        </TabsContent>
      </Tabs>

      <WeekLegend />
    </div>
  );
}

function RosterTable({
  students,
  empty = "No students match that search.",
}: {
  students: AssignedStudent[];
  empty?: string;
}) {
  if (students.length === 0) {
    return <TableEmpty icon={Users} message={empty} />;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead>Student</TableHead>
          <TableHead className="hidden sm:table-cell">Week &amp; day</TableHead>
          <TableHead className="hidden lg:table-cell">Progress</TableHead>
          <TableHead className="hidden md:table-cell">This week</TableHead>
          <TableHead className="hidden lg:table-cell text-right">Quiz avg</TableHead>
          <TableHead className="text-right">Review queue</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {students.map((s) => {
          const reason = attentionReason(s);
          const completedThisWeek = s.weekDays.filter(
            (d) => d === "done" || d === "late",
          ).length;

          return (
            <TableRow key={s.id}>
              {/* Student */}
              <TableCell>
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarFallback>{initials(s.name)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <div className="font-semibold text-ink">{s.name}</div>
                    <div className="truncate text-xs text-mute">{s.email}</div>
                    {reason && (
                      <Badge variant="warning" className="mt-1.5">
                        <AlertTriangle className="size-3.5" />
                        {reason}
                      </Badge>
                    )}
                  </div>
                </div>
              </TableCell>

              {/* Where they are in the programme */}
              <TableCell className="hidden whitespace-nowrap sm:table-cell">
                <div className="font-semibold text-ink">Week {s.week}</div>
                <div className="text-xs text-mute">
                  Day {s.daysCompleted} of {TOTAL_DAYS}
                </div>
              </TableCell>

              {/* Programme progress */}
              <TableCell className="hidden lg:table-cell">
                <div className="flex w-36 flex-col gap-1.5">
                  <span className="text-xs font-semibold tabular-nums text-ink">
                    {Math.round((s.daysCompleted / TOTAL_DAYS) * 100)}%
                  </span>
                  <Meter percent={(s.daysCompleted / TOTAL_DAYS) * 100} />
                </div>
              </TableCell>

              {/* This week's five teaching days */}
              <TableCell className="hidden md:table-cell">
                <div className="flex items-center gap-1.5">
                  {s.weekDays.map((state, i) => (
                    <span
                      key={i}
                      title={`Day ${i + 1} — ${DAY_STATE[state].label}`}
                      className={cn("size-2.5 rounded-full", DAY_STATE[state].dot)}
                    />
                  ))}
                </div>
                <div className="mt-1.5 text-xs text-mute">
                  {completedThisWeek}/{TEACHING_DAYS_PER_WEEK} days done
                </div>
              </TableCell>

              {/* Weekend assessment average */}
              <TableCell className="hidden text-right font-semibold tabular-nums text-ink lg:table-cell">
                {s.quizAvg}%
              </TableCell>

              {/* This trainer's queue for the student */}
              <TableCell className="text-right">
                {s.pendingReview === 0 ? (
                  <Badge variant="positive">
                    <CalendarCheck className="size-3.5" />
                    Clear
                  </Badge>
                ) : (
                  <Badge variant={s.pendingReview >= 3 ? "warning" : "neutral"}>
                    <ClipboardCheck className="size-3.5" />
                    {s.pendingReview} to review
                  </Badge>
                )}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

/** Decodes the week dots. Without it the colours are guesswork. */
function WeekLegend() {
  const items: DayState[] = ["done", "late", "pending", "missed", "upcoming"];

  return (
    <p className="mt-4 hidden flex-wrap items-center gap-x-4 gap-y-2 text-xs text-mute md:flex">
      <span className="font-semibold text-body">This week:</span>
      {items.map((state) => (
        <span key={state} className="flex items-center gap-1.5">
          <span className={cn("size-2.5 rounded-full", DAY_STATE[state].dot)} />
          {DAY_STATE[state].label}
        </span>
      ))}
    </p>
  );
}

/** Thin progress bar through the 60-day path. */
function Meter({ percent }: { percent: number }) {
  const value = Math.round(percent);

  return (
    <div
      role="meter"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
      className="h-1.5 w-full overflow-hidden rounded-full bg-secondary"
    >
      <div
        className="h-full rounded-full bg-primary"
        style={{ width: `${value}%` }}
      />
    </div>
  );
}

