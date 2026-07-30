import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import { TOTAL_TEACHING_DAYS, type StudentJourney } from "@/lib/student/progress";

// Shared progress furniture for the student screens. Every student page shows
// "how far am I" in some form, so the meter, the stat tile and the programme
// tracker live here rather than being redrawn slightly differently on each one.

/** Thin bar. `tone` only changes colour — the geometry is identical everywhere. */
export function Meter({
  percent,
  tone = "brand",
  label,
}: {
  percent: number;
  tone?: "brand" | "positive" | "warning" | "negative";
  label?: string;
}) {
  const value = Math.max(0, Math.min(100, Math.round(percent)));
  const fill = {
    brand: "bg-primary",
    positive: "bg-positive",
    warning: "bg-warning",
    negative: "bg-negative",
  }[tone];

  return (
    <div
      role="meter"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className="h-1.5 w-full overflow-hidden rounded-full bg-secondary"
    >
      <div className={cn("h-full rounded-full", fill)} style={{ width: `${value}%` }} />
    </div>
  );
}

/** One number in a stat row. Matches the staff dashboards' tile exactly. */
export function StatTile({
  label,
  value,
  hint,
  tone = "neutral",
  icon: Icon,
}: {
  label: string;
  value: string;
  hint: string;
  tone?: "positive" | "neutral" | "warning" | "negative";
  icon: LucideIcon;
}) {
  const chip = {
    positive: "bg-primary-pale text-positive-deep",
    neutral: "bg-secondary text-ink",
    warning: "bg-warning/25 text-warning-deep",
    negative: "bg-destructive/10 text-destructive",
  }[tone];

  return (
    <div className="rounded-xl border border-border bg-card p-3 sm:p-5">
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs text-body sm:text-sm">{label}</span>
        {/* Icon chip is decorative — drop it on phones to keep the card lean. */}
        <span
          className={cn(
            "hidden size-8 shrink-0 items-center justify-center rounded-full sm:flex",
            chip,
          )}
        >
          <Icon className="size-4" />
        </span>
      </div>
      <div className="mt-1.5 font-display text-2xl font-extrabold tabular-nums text-ink sm:mt-3 sm:text-3xl">
        {value}
      </div>
      {/* Hint is a nice-to-have; hide it on phones so cards stay minimal. */}
      <div className="mt-1 hidden text-xs text-mute sm:block">{hint}</div>
    </div>
  );
}

/**
 * The programme progress bar — day count, percentage and what is left.
 * Deliberately frames the remainder as "days to go" rather than "days behind":
 * the student is on a path, not in a deficit.
 */
export function ProgressTracker({ journey }: { journey: StudentJourney }) {
  const percent = Math.round((journey.daysCompleted / TOTAL_TEACHING_DAYS) * 100);
  const remaining = TOTAL_TEACHING_DAYS - journey.daysCompleted;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div className="flex items-baseline gap-2">
          <span className="font-display text-3xl font-extrabold tabular-nums text-ink">
            Day {journey.currentDay}
          </span>
          <span className="text-sm text-mute">of {TOTAL_TEACHING_DAYS}</span>
        </div>
        <span className="text-sm font-semibold tabular-nums text-ink">{percent}%</span>
      </div>

      <Meter percent={percent} label="Programme progress" />

      <p className="text-xs text-mute">
        Week {journey.currentWeek} of 12 · {remaining} teaching{" "}
        {remaining === 1 ? "day" : "days"} to go
      </p>
    </div>
  );
}
