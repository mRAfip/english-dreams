"use client";

import * as React from "react";
import { Minus, Search, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
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
  type LeaderboardEntry,
  type WeeklyLeaderboard,
} from "@/types/leaderboard";

// Admin > Leaderboard — one week at a time, every student ranked together on
// that week's two weekend quizzes (Saturday practice + Sunday assessment)
// summed. The week is the only axis. Renders inside the (dashboard) shell,
// which supplies <main>, the max-width and the page padding — so this is a
// plain block, not a page frame.
//
// Boards are built server-side from the students table + their weekend-quiz
// attempts (see lib/leaderboard/board.ts). This component only picks a week and
// filters — no data generation.

export function LeaderboardTable({ boards }: { boards: WeeklyLeaderboard[] }) {
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
      viewer: null,
      participants: 0,
    };

  const stats = React.useMemo(
    () => leaderboardStats(board.entries),
    [board.entries],
  );

  // The search filters rows AFTER ranking, so looking one student up shows
  // their true position on the board rather than "1st of 1".
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
            Ranked on the week's two graded weekend papers — Saturday plus
            Sunday, {WEEKLY_MAX_SCORE} marks in total. Only students who have sat
            a paper this week are shown.
          </p>
        </div>

        {board.participants > 0 && (
          <dl className="flex items-center gap-6">
            <Stat label="Top score" value={`${stats.topScore}`} />
            <Stat label="Average" value={`${stats.average}`} />
            <Stat
              label="Sat both papers"
              value={`${stats.bothAttempted}/${board.participants}`}
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
                placeholder="Search students"
                label="Search students"
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
                {board.title} · {board.participants} students ranked
                {stats.noneAttempted > 0 && (
                  <> · {stats.noneAttempted} sat neither paper</>
                )}
              </p>

              <div className="mt-4">
                {rows.length === 0 ? (
                  <TableEmpty
                    icon={Search}
                    message={`No student matches "${query.trim()}".`}
                  />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="w-16">Rank</TableHead>
                        <TableHead>Student</TableHead>
                        <TableHead className="text-right">Saturday</TableHead>
                        <TableHead className="text-right">Sunday</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((entry) => (
                        <Row key={entry.studentId} entry={entry} />
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

function Row({ entry }: { entry: LeaderboardEntry }) {
  return (
    <TableRow>
      <TableCell>
        <RankMark rank={entry.rank} />
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
          </div>
        </div>
      </TableCell>

      <TableCell className="text-right tabular-nums">
        <Score value={entry.scores.saturday} />
      </TableCell>
      <TableCell className="text-right tabular-nums">
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

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}
