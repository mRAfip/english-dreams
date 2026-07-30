"use client";

import * as React from "react";
import { ArrowUp, Minus, Search, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DirectoryFilters,
  DirectoryToolbar,
  SearchField,
  TAB_PANEL_CLASS,
} from "@/components/admin/directory-toolbar";
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { leaderboardStats } from "@/lib/leaderboard/weekly";
import {
  WEEKEND_QUIZ_MAX,
  WEEKLY_MAX_SCORE,
  type TrainerLeaderboard as TrainerLeaderboardData,
  type TrainerLeaderboardEntry,
} from "@/types/leaderboard";

// Trainer > Leaderboard — one week at a time, the trainer's assigned students
// ranked against each other on that week's two weekend quizzes.
//
// The board is scoped, the standing is not. Rank is among your students, but
// every row also carries its cohort-wide position, because those two numbers
// disagree constantly: your #1 can be 6th of 14 programme-wide, and your 5th
// can still be ahead of most students under other trainers. Showing only the
// scoped rank would flatter the group; showing only the cohort rank would bury
// it. Both columns, side by side.
//
// Renders inside the (dashboard) shell, which supplies <main>, the max-width
// and the page padding — so this is a plain block, not a page frame.
//
// Boards are built server-side from the student_trainer_assignments +
// student_quiz_attempts tables (see lib/leaderboard/trainer-board). This
// component only picks a week and filters.

export function TrainerLeaderboard({
  boards,
}: {
  boards: TrainerLeaderboardData[];
}) {
  const weeks = boards;
  const [selected, setSelected] = React.useState(
    () => weeks.at(-1)?.weekNumber ?? 0,
  );
  const [query, setQuery] = React.useState("");

  const board =
    weeks.find((b) => b.weekNumber === selected) ??
    weeks.at(-1) ?? {
      weekNumber: 0,
      title: "",
      entries: [],
      assigned: 0,
      cohortSize: 0,
    };

  const stats = React.useMemo(
    () => leaderboardStats(board.entries),
    [board.entries],
  );

  // How the group is doing against everyone else — the number a trainer is
  // actually judged on. Counts rows sitting in the cohort's top third.
  const inCohortTopThird = board.entries.filter(
    (e) => e.cohortRank <= Math.ceil(board.cohortSize / 3),
  ).length;

  // Search filters AFTER ranking, so looking one student up still shows their
  // true position rather than "1st of 1".
  const term = query.trim().toLowerCase();
  const rows = term
    ? board.entries.filter((e) => e.name.toLowerCase().includes(term))
    : board.entries;

  return (
    <div>
      <header className="flex flex-col gap-5 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1.5">
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink">
            Leaderboard
          </h1>
          <p className="text-sm text-body">
            Your students, ranked on the weekend quizzes — Saturday practice plus
            Sunday assessment, {WEEKLY_MAX_SCORE} marks in total.
          </p>
        </div>

        {board.assigned > 0 && (
          <dl className="flex items-center gap-6">
            <Stat label="Top score" value={`${stats.topScore}`} />
            <Stat label="Average" value={`${stats.average}`} />
            <Stat
              label="In cohort top third"
              value={`${inCohortTopThird}/${board.assigned}`}
            />
          </dl>
        )}
      </header>

      {weeks.length === 0 ? (
        <TableEmpty
          className="mt-6"
          icon={Trophy}
          message="No weekend results yet. The board opens once a week's quizzes are published and graded."
        />
      ) : (
        // One tab per week — only weeks whose quizzes are published appear.
        <Tabs
          value={String(selected)}
          onValueChange={(value) => setSelected(Number(value))}
          className="mt-6"
        >
          <DirectoryToolbar>
            <TabsList className="flex-wrap">
              {weeks.map((week) => (
                <TabsTrigger key={week.weekNumber} value={String(week.weekNumber)}>
                  Week {week.weekNumber}
                </TabsTrigger>
              ))}
            </TabsList>

            <DirectoryFilters>
              <SearchField
                value={query}
                onChange={setQuery}
                placeholder="Search your students"
                label="Search your students"
              />
            </DirectoryFilters>
          </DirectoryToolbar>

          {weeks.map((week) => (
            <TabsContent
              key={week.weekNumber}
              value={String(week.weekNumber)}
              className={TAB_PANEL_CLASS}
            >
              <p className="text-sm text-mute">
                {board.title} · {board.assigned} of your students ranked, out of{" "}
                {board.cohortSize} across the programme
                {stats.noneAttempted > 0 && (
                  <> · {stats.noneAttempted} sat neither paper</>
                )}
              </p>

              <div className="mt-4">
                {rows.length === 0 ? (
                  <TableEmpty
                    icon={Search}
                    message={
                      term
                        ? `No student of yours matches "${query.trim()}".`
                        : "No students are assigned to you yet."
                    }
                  />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="w-16">Rank</TableHead>
                        <TableHead>Student</TableHead>
                        <TableHead className="hidden sm:table-cell">
                          Cohort standing
                        </TableHead>
                        <TableHead className="hidden md:table-cell text-right">
                          Sat · practice
                        </TableHead>
                        <TableHead className="hidden md:table-cell text-right">
                          Sun · assessment
                        </TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((entry) => (
                        <Row
                          key={entry.studentId}
                          entry={entry}
                          cohortSize={board.cohortSize}
                        />
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-right">
      <dd className="font-display text-2xl font-extrabold tabular-nums text-ink">
        {value}
      </dd>
      <dt className="text-xs text-mute">{label}</dt>
    </div>
  );
}

function Row({
  entry,
  cohortSize,
}: {
  entry: TrainerLeaderboardEntry;
  cohortSize: number;
}) {
  return (
    <TableRow>
      <TableCell>
        <RankMark rank={entry.groupRank} />
      </TableCell>

      <TableCell>
        <div className="flex items-center gap-3">
          <Avatar>
            {entry.avatarUrl && <AvatarImage src={entry.avatarUrl} alt="" />}
            <AvatarFallback>{initials(entry.name)}</AvatarFallback>
          </Avatar>
          <div>
            <div className="text-sm font-semibold text-ink">{entry.name}</div>
            {entry.attempted < 2 && (
              <div className="text-xs text-mute">
                {entry.attempted} of 2 quizzes attempted
              </div>
            )}
            {/* The cohort standing rides along on mobile, where its column is hidden. */}
            <div className="mt-1 sm:hidden">
              <CohortStanding entry={entry} cohortSize={cohortSize} />
            </div>
          </div>
        </div>
      </TableCell>

      <TableCell className="hidden sm:table-cell">
        <CohortStanding entry={entry} cohortSize={cohortSize} />
      </TableCell>

      <TableCell className="hidden text-right tabular-nums md:table-cell">
        <Score value={entry.scores.saturday} />
      </TableCell>
      <TableCell className="hidden text-right tabular-nums md:table-cell">
        <Score value={entry.scores.sunday} />
      </TableCell>
      <TableCell className="text-right">
        <span className="font-display text-base font-extrabold tabular-nums text-ink">
          {entry.total}
        </span>
        <span className="text-xs text-mute">/{WEEKLY_MAX_SCORE}</span>
      </TableCell>
    </TableRow>
  );
}

/**
 * Where the student sits across the whole programme, not just this board.
 * A podium finish cohort-wide is worth calling out — it is the thing the scoped
 * rank cannot tell you.
 */
function CohortStanding({
  entry,
  cohortSize,
}: {
  entry: TrainerLeaderboardEntry;
  cohortSize: number;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm tabular-nums text-body">
        {ordinal(entry.cohortRank)}{" "}
        <span className="text-xs text-mute">of {cohortSize}</span>
      </span>
      {entry.cohortRank <= 3 && (
        <Badge variant="brand">
          <ArrowUp className="size-3.5" />
          Top {entry.cohortRank} overall
        </Badge>
      )}
    </div>
  );
}

/** A single paper's mark. Never attempted reads as a dash, not a zero. */
function Score({ value }: { value: number | null }) {
  if (value === null) {
    return (
      <span className="inline-flex text-mute" title="Not attempted">
        <Minus className="size-4" aria-label="Not attempted" />
      </span>
    );
  }
  return (
    <span className="text-ink">
      {value}
      <span className="text-xs text-mute">/{WEEKEND_QUIZ_MAX}</span>
    </span>
  );
}

/** Top three get a filled disc; everyone else gets a plain number. */
function RankMark({ rank }: { rank: number }) {
  const podium: Record<number, string> = {
    1: "bg-warning text-warning-deep",
    2: "bg-secondary text-ink",
    3: "bg-primary-pale text-ink-deep",
  };

  return (
    <span
      className={cn(
        "inline-flex size-8 items-center justify-center rounded-full text-sm font-bold tabular-nums",
        podium[rank] ?? "text-mute",
      )}
    >
      {rank}
    </span>
  );
}

/** 1 → 1st, 2 → 2nd, 13 → 13th. */
function ordinal(n: number): string {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
  const suffix = { 1: "st", 2: "nd", 3: "rd" }[n % 10] ?? "th";
  return `${n}${suffix}`;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}
