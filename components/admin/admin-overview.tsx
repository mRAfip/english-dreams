import Link from "next/link";
import {
  Award,
  BookOpen,
  CreditCard,
  GraduationCap,
  Lock,
  Plus,
  UserPlus,
  Users,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type {
  AdminOverviewData,
  AttentionItem,
  AttentionReason,
} from "@/lib/admin/overview";

// Admin home — real operations data:
//   • empty slate (no students, no trainers) → an onboarding screen
//   • otherwise → a stat row, the "needs attention" queue, and trainer loads.
// Server component: nothing here is interactive, so it ships no client JS.

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
const WEEKDAYS = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
];

function today(): string {
  const d = new Date();
  return `${WEEKDAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

const REASON: Record<
  AttentionReason,
  { label: string; variant: "negative" | "warning" | "neutral"; icon: LucideIcon }
> = {
  suspended: { label: "Access disabled", variant: "negative", icon: Lock },
  fees: { label: "Fees due", variant: "warning", icon: CreditCard },
  unassigned: { label: "No trainer", variant: "neutral", icon: UserPlus },
};

export function AdminOverview({
  name,
  data,
}: {
  name: string;
  data: AdminOverviewData;
}) {
  return (
    <div>
      <header className="flex flex-row items-center justify-between gap-4 border-b border-border pb-6">
        <div className="flex flex-col gap-0.5 min-w-0">
          <h1 className="truncate font-display text-xl sm:text-3xl font-extrabold tracking-tight text-ink">
            Welcome back, {name}
          </h1>
          <p className="truncate text-xs sm:text-sm text-body">{today()}</p>
        </div>

        {!data.isEmpty && (
          <Button asChild className="shrink-0 h-9 sm:h-11 px-3 sm:px-6 text-xs sm:text-sm rounded-lg sm:rounded-xl">
            <Link href="/admin/students">
              <Plus />
              Add student
            </Link>
          </Button>
        )}
      </header>

      {data.isEmpty ? <EmptyState /> : <Dashboard data={data} />}
    </div>
  );
}

/** Shown on a fresh install — nothing to report yet, so point the way. */
function EmptyState() {
  const steps = [
    {
      icon: GraduationCap,
      title: "Add your trainers",
      body: "Create trainer accounts so you can assign students to them.",
      href: "/admin/trainers",
      cta: "Go to Trainers",
    },
    {
      icon: Users,
      title: "Enrol students",
      body: "Provision student accounts and assign each one a trainer.",
      href: "/admin/students",
      cta: "Go to Students",
    },
    {
      icon: BookOpen,
      title: "Build the curriculum",
      body: "Upload the class videos, notes and daily tasks for the 60 days.",
      href: "/admin/content-management",
      cta: "Go to Content",
    },
  ];

  return (
    <div className="mt-10 flex flex-col items-center text-center">
      <span className="grid size-14 place-items-center rounded-2xl bg-primary-pale text-ink-deep">
        <Users className="size-7" />
      </span>
      <h2 className="mt-5 font-display text-2xl font-extrabold tracking-tight text-ink">
        Let&apos;s set up English Dreams
      </h2>
      <p className="mt-2 max-w-md text-sm text-body">
        There&apos;s no one here yet. Work through these three steps and your
        dashboard will fill in on its own.
      </p>

      <div className="mt-8 grid w-full gap-4 text-left sm:grid-cols-3">
        {steps.map((step, i) => (
          <div
            key={step.title}
            className="flex flex-col rounded-xl border border-border bg-card p-5"
          >
            <div className="flex items-center gap-3">
              <span className="grid size-9 place-items-center rounded-lg bg-secondary text-ink">
                <step.icon className="size-4" />
              </span>
              <span className="text-xs font-semibold text-mute">
                Step {i + 1}
              </span>
            </div>
            <h3 className="mt-4 text-sm font-semibold text-ink">{step.title}</h3>
            <p className="mt-1 flex-1 text-sm text-body">{step.body}</p>
            <Button variant="tertiary" size="sm" asChild className="mt-4 self-start">
              <Link href={step.href}>{step.cta}</Link>
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

function Dashboard({ data }: { data: AdminOverviewData }) {
  const stats = [
    {
      label: "Students",
      value: String(data.studentCount),
      hint:
        data.unassigned > 0
          ? `${data.unassigned} without a trainer`
          : "all assigned",
      tone: "neutral" as const,
      icon: Users,
    },
    {
      label: "Trainers",
      value: String(data.trainerCount),
      hint: data.trainerCount === 0 ? "add your first" : "on the team",
      tone: "neutral" as const,
      icon: GraduationCap,
    },
    {
      label: "Fees due",
      value: String(data.feesDue),
      hint: data.feesDue > 0 ? "students to follow up" : "all up to date",
      tone: (data.feesDue > 0 ? "warning" : "positive") as
        | "warning"
        | "positive",
      icon: CreditCard,
    },
    {
      label: "Certificates issued",
      value: String(data.certificatesIssued),
      hint: "graduates",
      tone: "positive" as const,
      icon: Award,
    },
  ];

  const maxLoad = Math.max(1, ...data.trainers.map((t) => t.students));

  return (
    <>
      <section
        aria-label="Key numbers"
        className="mt-6 grid gap-3 grid-cols-2 xl:grid-cols-4"
      >
        {stats.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* Needs attention — the working queue. */}
        <section aria-labelledby="attention-heading" className="lg:col-span-2">
          <h2
            id="attention-heading"
            className="font-display text-lg sm:text-xl font-extrabold text-ink"
          >
            Needs attention
          </h2>

          <div className="mt-4">
            {data.attention.length === 0 ? (
              <TableEmpty icon={Users} message="Nothing needs chasing today." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Student</TableHead>
                    <TableHead>Issue</TableHead>
                    <TableHead className="hidden text-right md:table-cell">
                      Trainer
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.attention.map((row) => (
                    <AttentionRow key={row.id} row={row} />
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </section>

        {/* Trainer loads. */}
        <section aria-labelledby="trainers-heading">
          <h2
            id="trainers-heading"
            className="font-display text-lg sm:text-xl font-extrabold text-ink"
          >
            Trainer load
          </h2>

          <div className="mt-4 rounded-xl border border-border bg-card p-4 sm:p-6">
            {data.trainers.length === 0 ? (
              <p className="text-sm text-mute">
                No trainers yet.{" "}
                <Link
                  href="/admin/trainers"
                  className="font-semibold text-brand-green hover:underline"
                >
                  Add one
                </Link>{" "}
                to start assigning students.
              </p>
            ) : (
              <ul className="flex flex-col gap-3.5">
                {data.trainers.map((trainer) => (
                  <li key={trainer.id} className="flex flex-col gap-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <Link
                        href={`/admin/trainers/${trainer.id}`}
                        className="truncate text-xs sm:text-sm font-semibold text-ink hover:underline"
                      >
                        {trainer.name}
                      </Link>
                      <span className="shrink-0 text-xs sm:text-sm font-semibold tabular-nums text-ink">
                        {trainer.students}
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${(trainer.students / maxLoad) * 100}%` }}
                      />
                    </div>
                    <div className="text-[10px] sm:text-xs text-mute">
                      {trainer.students === 1
                        ? "1 student"
                        : `${trainer.students} students`}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </>
  );
}

function AttentionRow({ row }: { row: AttentionItem }) {
  const flag = REASON[row.reason];
  return (
    <TableRow>
      <TableCell className="py-2.5 sm:py-4">
        <div className="flex items-center gap-2 sm:gap-3">
          <Avatar className="size-8 sm:size-9">
            {row.avatarUrl && <AvatarImage src={row.avatarUrl} alt="" />}
            <AvatarFallback className="text-[10px] sm:text-xs">{initials(row.name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <Link
              href={`/admin/students/${row.id}`}
              className="font-semibold text-ink hover:underline text-xs sm:text-sm truncate block"
            >
              {row.name}
            </Link>
            <div className="truncate text-[10px] sm:text-xs text-mute">{row.email}</div>
          </div>
        </div>
      </TableCell>
      <TableCell className="py-2.5 sm:py-4">
        <Badge variant={flag.variant} className="text-[10px] sm:text-xs py-0.5 px-2">
          <flag.icon className="size-3 sm:size-3.5" />
          {flag.label}
        </Badge>
      </TableCell>
      <TableCell className="hidden text-right text-mute md:table-cell py-2.5 sm:py-4 text-xs sm:text-sm">
        {row.trainerName ?? "—"}
      </TableCell>
    </TableRow>
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
  const chip = {
    positive: "bg-positive-pale text-positive-deep",
    neutral: "bg-primary-pale text-ink-deep",
    warning: "bg-warning/25 text-warning-deep",
    negative: "bg-destructive/10 text-destructive",
  }[tone];

  return (
    <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs sm:text-sm text-body line-clamp-1">{label}</span>
        <span
          className={cn(
            "flex size-7 sm:size-8 shrink-0 items-center justify-center rounded-full",
            chip,
          )}
        >
          <Icon className="size-3.5 sm:size-4" />
        </span>
      </div>
      <div className="mt-2.5 font-display text-xl sm:text-3xl font-extrabold tabular-nums text-ink leading-none">
        {value}
      </div>
      <div className="mt-1.5 text-[10px] sm:text-xs text-mute line-clamp-1">{hint}</div>
    </div>
  );
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}
