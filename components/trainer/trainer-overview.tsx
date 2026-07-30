import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpRight,
  ClipboardCheck,
  Clock,
  FileText,
  Headphones,
  Image as ImageIcon,
  MessageSquare,
  Timer,
  Users,
  Video,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  loadReviewQueue,
  slaLevel,
  waitingLabel,
  type Submission,
  type SubmissionAsset,
} from "@/lib/tasks/review";
import {
  attentionReason,
  attentionSeverity,
  daysDoneThisWeek,
  initials,
  loadAssignedStudents,
  TEACHING_DAYS_PER_WEEK,
  TOTAL_DAYS,
  type AssignedStudent,
} from "@/lib/trainer/roster";

// Trainer home — the screen a trainer opens each morning and works down.
//
// The whole page answers one question in order: what do I owe, and who is
// slipping? Three bands:
//   1. Stat row     — the four numbers that decide how the day goes.
//   2. Review queue — the actual work, oldest first, so nothing breaches the
//      48-hour feedback promise. Widest column because it is the job.
//   3. Side rail    — students to chase, and how the week is tracking.
//
// Renders inside the (dashboard) shell, which supplies <main>, the max-width
// and the page padding — so this is a plain block, not a page frame.
//
// Server component on purpose: nothing here is interactive (grading happens on
// /trainer/review-tasks), so it ships no client JS. Both data sources are the
// same scaffold modules the roster and review screens read, so the counts on
// this page and the counts on those pages can never drift apart.

/** How many queue rows fit before the list stops being glanceable. */
const QUEUE_PREVIEW = 5;
/** Students to chase, before the rail turns into a second roster page. */
const ATTENTION_PREVIEW = 4;

const ASSET_ICON: Record<SubmissionAsset["kind"], LucideIcon> = {
  audio: Headphones,
  video: Video,
  document: FileText,
  image: ImageIcon,
};

const SLA: Record<
  ReturnType<typeof slaLevel>,
  { variant: "positive" | "warning" | "negative"; label: string }
> = {
  fresh: { variant: "positive", label: "In time" },
  due: { variant: "warning", label: "Due today" },
  overdue: { variant: "negative", label: "Overdue" },
};

export function TrainerOverview({ name }: { name: string }) {
  const queue = loadReviewQueue();
  const roster = loadAssignedStudents();

  const pending = queue
    .filter((s) => s.status === "pending")
    .sort((a, b) => b.hoursWaiting - a.hoursWaiting);
  const overdue = pending.filter((s) => slaLevel(s) === "overdue");

  // Reviewed by this trainer since the queue was last cleared — the "done"
  // number that makes the pending number feel survivable.
  const reviewed = queue.filter((s) => s.status !== "pending");

  const flagged = roster
    .filter((s) => attentionReason(s) !== null)
    .sort((a, b) =>
      attentionSeverity(a) === attentionSeverity(b)
        ? 0
        : attentionSeverity(a) === "high"
          ? -1
          : 1,
    );

  // Week attendance across the roster: days actually closed out, over the days
  // that have been released so far. Upcoming days don't count against anyone.
  const releasedDays = roster.reduce(
    (sum, s) => sum + s.weekDays.filter((d) => d !== "upcoming").length,
    0,
  );
  const closedDays = roster.reduce((sum, s) => sum + daysDoneThisWeek(s), 0);
  const attendance = releasedDays === 0 ? 0 : Math.round((closedDays / releasedDays) * 100);

  return (
    <div>
      {/* Header — greeting on the left, the one action that clears the day on
          the right. */}
      <header className="flex flex-col gap-5 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1.5">
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink">
            Good morning, {name}
          </h1>
          <p className="text-sm text-body">
            Monday, 20 July 2026 · {pending.length} submissions waiting on your
            feedback
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button asChild>
            <Link href="/trainer/review-tasks">
              <ClipboardCheck />
              Start reviewing
            </Link>
          </Button>
        </div>
      </header>

      {/* 1. Stat row */}
      <section
        aria-label="Today's numbers"
        className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        <StatCard
          label="Awaiting review"
          value={String(pending.length)}
          hint={`${reviewed.length} cleared this week`}
          tone={pending.length > 8 ? "warning" : "neutral"}
          icon={ClipboardCheck}
        />
        <StatCard
          label="Past the 48h promise"
          value={String(overdue.length)}
          hint={
            overdue.length === 0
              ? "queue is inside the SLA"
              : `oldest ${waitingLabel(pending[0]?.hoursWaiting ?? 0)}`
          }
          tone={overdue.length === 0 ? "positive" : "negative"}
          icon={Timer}
        />
        <StatCard
          label="Your students"
          value={String(roster.length)}
          hint={`${flagged.length} need chasing`}
          tone={flagged.length === 0 ? "positive" : "neutral"}
          icon={Users}
        />
        <StatCard
          label="Attendance this week"
          value={`${attendance}%`}
          hint={`${closedDays} of ${releasedDays} released days done`}
          tone={attendance >= 80 ? "positive" : attendance >= 65 ? "warning" : "negative"}
          icon={Clock}
        />
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* 2. The queue — oldest first, because that is the one that breaches. */}
        <section aria-labelledby="queue-heading" className="lg:col-span-2">
          <div className="flex items-end justify-between gap-4">
            <h2
              id="queue-heading"
              className="font-display text-xl font-extrabold text-ink"
            >
              Review queue
            </h2>
            <Button variant="tertiary" size="sm" asChild>
              <Link href="/trainer/review-tasks">
                Open queue
                <ArrowUpRight />
              </Link>
            </Button>
          </div>

          <div className="mt-4 flex flex-col gap-3">
            {pending.length === 0 ? (
              <EmptyCard
                icon={ClipboardCheck}
                message="Queue is clear. Every submission has feedback."
              />
            ) : (
              pending
                .slice(0, QUEUE_PREVIEW)
                .map((s) => <QueueRow key={s.id} submission={s} />)
            )}

            {pending.length > QUEUE_PREVIEW && (
              <Link
                href="/trainer/review-tasks"
                className="rounded-xl border border-dashed border-border px-5 py-3 text-center text-sm font-semibold text-ink hover:bg-secondary"
              >
                {pending.length - QUEUE_PREVIEW} more waiting
              </Link>
            )}
          </div>
        </section>

        {/* 3. Side rail — who to chase, then how the week is tracking. */}
        <div className="flex flex-col gap-6">
          <section aria-labelledby="attention-heading">
            <div className="flex items-end justify-between gap-4">
              <h2
                id="attention-heading"
                className="font-display text-xl font-extrabold text-ink"
              >
                Needs chasing
              </h2>
              <Button variant="tertiary" size="sm" asChild>
                <Link href="/trainer/assigned-students">
                  Roster
                  <ArrowUpRight />
                </Link>
              </Button>
            </div>

            <div className="mt-4 rounded-xl border border-border bg-card p-6">
              {flagged.length === 0 ? (
                <p className="text-sm text-body">
                  Everyone is on track this week.
                </p>
              ) : (
                <ul className="flex flex-col gap-4">
                  {flagged.slice(0, ATTENTION_PREVIEW).map((s) => (
                    <FlaggedStudent key={s.id} student={s} />
                  ))}
                </ul>
              )}
            </div>
          </section>

          <section aria-labelledby="week-heading">
            <h2
              id="week-heading"
              className="font-display text-xl font-extrabold text-ink"
            >
              Your week
            </h2>

            <div className="mt-4 flex flex-col gap-4 rounded-xl border border-border bg-card p-6">
              <WeekBar closed={closedDays} released={releasedDays} />
              <dl className="flex flex-col gap-3 text-sm">
                <Line
                  term="Submissions reviewed"
                  detail={`${reviewed.length} of ${queue.length}`}
                />
                <Line
                  term="Redo requested"
                  detail={String(queue.filter((s) => s.status === "redo").length)}
                />
                <Line
                  term="Teaching days per student"
                  detail={`${TEACHING_DAYS_PER_WEEK} · ${TOTAL_DAYS}-day programme`}
                />
              </dl>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

/** One waiting submission — enough to decide whether to open it now. */
function QueueRow({ submission }: { submission: Submission }) {
  const sla = SLA[slaLevel(submission)];

  return (
    <Link
      href="/trainer/review-tasks"
      className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5 hover:border-ink sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex min-w-0 items-center gap-3">
        <Avatar>
          <AvatarFallback>{initials(submission.studentName)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <div className="font-semibold text-ink">{submission.studentName}</div>
          <div className="truncate text-sm text-body">
            Day {submission.dayNumber} · {submission.taskTitle}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-mute">
            <span>{submission.submittedAt}</span>
            {submission.assets.map((asset) => {
              const Icon = ASSET_ICON[asset.kind];
              return (
                <span key={asset.id} className="flex items-center gap-1">
                  <Icon className="size-3.5" />
                  {asset.meta}
                </span>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2 sm:flex-col sm:items-end">
        <Badge variant={sla.variant}>{sla.label}</Badge>
        <span className="text-xs text-mute">
          {waitingLabel(submission.hoursWaiting)}
          {submission.late && " · submitted late"}
        </span>
      </div>
    </Link>
  );
}

/** A student who has drifted — the reason, and the fastest way to act on it. */
function FlaggedStudent({ student }: { student: AssignedStudent }) {
  const reason = attentionReason(student);
  const high = attentionSeverity(student) === "high";

  return (
    <li className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="text-sm font-semibold text-ink">{student.name}</div>
        <div className="text-xs text-mute">
          Week {student.week} · day {student.daysCompleted} of {TOTAL_DAYS}
        </div>
        <Badge variant={high ? "negative" : "warning"} className="mt-1.5">
          <AlertTriangle className="size-3.5" />
          {reason}
        </Badge>
      </div>
      {/* The useful reply to drifting is a message, so link straight there. */}
      <Button variant="outline" size="icon" asChild>
        <Link href="/inbox" aria-label={`Message ${student.name}`}>
          <MessageSquare />
        </Link>
      </Button>
    </li>
  );
}

function StatCard({
  label,
  value,
  hint,
  tone,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint: string;
  tone: "positive" | "neutral" | "warning" | "negative";
  icon: LucideIcon;
}) {
  // The icon chip carries the tone; the number itself stays ink so the row
  // reads as one set of figures rather than a traffic light.
  const chip = {
    positive: "bg-primary-pale text-positive-deep",
    neutral: "bg-secondary text-ink",
    warning: "bg-warning/25 text-warning-deep",
    negative: "bg-destructive/10 text-destructive",
  }[tone];

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <span className="text-sm text-body">{label}</span>
        <span
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-full",
            chip,
          )}
        >
          <Icon className="size-4" />
        </span>
      </div>
      <div className="mt-3 font-display text-3xl font-extrabold tabular-nums text-ink">
        {value}
      </div>
      <div className="mt-1 text-xs text-mute">{hint}</div>
    </div>
  );
}

/** Roster attendance for the week, as a share of the days released so far. */
function WeekBar({ closed, released }: { closed: number; released: number }) {
  const percent = released === 0 ? 0 : Math.round((closed / released) * 100);
  const fill =
    percent >= 80 ? "bg-positive" : percent >= 65 ? "bg-warning" : "bg-negative";

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm text-body">Days closed out</span>
        <span className="text-sm font-semibold tabular-nums text-ink">
          {closed}/{released}
        </span>
      </div>
      <div
        role="meter"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Roster attendance this week"
        className="h-1.5 w-full overflow-hidden rounded-full bg-secondary"
      >
        <div
          className={cn("h-full rounded-full", fill)}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

function Line({ term, detail }: { term: string; detail: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-body">{term}</dt>
      <dd className="font-semibold tabular-nums text-ink">{detail}</dd>
    </div>
  );
}

function EmptyCard({ icon: Icon, message }: { icon: LucideIcon; message: string }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-card px-6 py-12 text-center">
      <Icon className="size-6 text-mute" />
      <p className="text-sm text-body">{message}</p>
    </div>
  );
}
