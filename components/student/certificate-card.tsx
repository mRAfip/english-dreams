import Link from "next/link";
import {
  Award,
  Check,
  Download,
  Lock,
  Share2,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Meter } from "@/components/student/progress-tracker";
import { PASS_MARK } from "@/lib/student/quiz-bank";
import {
  allDays,
  allQuizzes,
  quizAverage,
  TOTAL_TEACHING_DAYS,
  type StudentJourney,
} from "@/lib/student/progress";
import type { IssuedCertificate } from "@/types/certificate";

// Student > Certificates — the thing the whole 60 days is for.
//
// Before graduation this screen has one job: make the goal feel reachable and
// say exactly what is left. So it leads with the certificate itself (locked,
// but drawn in full), then lists the three requirements with live progress
// against each. Vague "keep going" encouragement helps nobody; "9 more days and
// two assessments" does.
//
// Once the admin issues the certificate, the same card carries the download.

/** One condition of graduating, with the student's live standing against it. */
type Requirement = {
  label: string;
  detail: string;
  done: number;
  total: number;
  met: boolean;
};

export function CertificateView({
  name,
  journey,
  certificate,
}: {
  name: string;
  journey: StudentJourney;
  certificate: IssuedCertificate | null;
}) {
  const days = allDays(journey);
  const quizzes = allQuizzes(journey);
  const satAssessments = quizzes.filter((q) => q.state === "done");
  const average = quizAverage(journey);

  const requirements: Requirement[] = [
    {
      label: "Finish all 60 teaching days",
      detail: "Watch the class and send the day's task",
      done: journey.daysCompleted,
      total: TOTAL_TEACHING_DAYS,
      met: journey.daysCompleted >= TOTAL_TEACHING_DAYS,
    },
    {
      label: "Sit every weekend paper",
      detail: "Two graded papers per week",
      done: satAssessments.length,
      total: quizzes.length,
      met: satAssessments.length >= quizzes.length,
    },
    {
      label: `Average ${PASS_MARK}% or above`,
      detail: "Across your graded assessments",
      done: Math.min(average ?? 0, PASS_MARK),
      total: PASS_MARK,
      met: (average ?? 0) >= PASS_MARK,
    },
  ];

  const earned = requirements.every((r) => r.met);
  const issued = certificate !== null;
  // Weeks fully behind the student — the milestones already banked.
  const weeksDone = journey.weeks.filter((w) => w.state === "done").length;
  const tasksSent = days.filter((d) => d.task.state !== "open" && d.task.state !== "missed")
    .length;

  return (
    <div>
      {/* Header */}
      <header className="flex flex-col gap-5 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1.5">
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink">
            Certificate
          </h1>
          <p className="text-sm text-body">
            {issued
              ? "You finished the programme. Here it is."
              : earned
                ? "You've met every requirement — your certificate is on its way."
                : "Issued when you finish the 60 days and pass your assessments."}
          </p>
        </div>
      </header>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* The certificate itself */}
        <section aria-labelledby="certificate-heading" className="lg:col-span-2">
          <h2 id="certificate-heading" className="sr-only">
            Your certificate
          </h2>
          <CertificateCard
            name={name}
            earned={earned}
            certificate={certificate}
            journey={journey}
          />
        </section>

        {/* What is left */}
        <div className="flex flex-col gap-6">
          <section aria-labelledby="requirements-heading">
            <h2
              id="requirements-heading"
              className="font-display text-xl font-extrabold text-ink"
            >
              What you need
            </h2>

            <ul className="mt-4 flex flex-col gap-5 rounded-xl border border-border bg-card p-6">
              {requirements.map((req) => (
                <li key={req.label} className="flex flex-col gap-2">
                  <div className="flex items-start gap-3">
                    <span
                      className={cn(
                        "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full",
                        req.met
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary text-mute",
                      )}
                    >
                      {req.met && <Check className="size-3" />}
                    </span>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-ink">{req.label}</div>
                      <div className="text-xs text-mute">{req.detail}</div>
                    </div>
                    <span className="ml-auto shrink-0 text-sm font-semibold tabular-nums text-ink">
                      {req.done}/{req.total}
                    </span>
                  </div>
                  <Meter
                    percent={(req.done / req.total) * 100}
                    tone={req.met ? "positive" : "brand"}
                    label={req.label}
                  />
                </li>
              ))}
            </ul>
          </section>

          {/* Milestones already banked — proof the effort has added up. */}
          <section aria-labelledby="milestones-heading">
            <h2
              id="milestones-heading"
              className="font-display text-xl font-extrabold text-ink"
            >
              Banked so far
            </h2>

            <div className="mt-4 grid grid-cols-3 gap-3">
              <Milestone icon={Check} value={String(weeksDone)} label="weeks done" />
              <Milestone icon={Award} value={String(tasksSent)} label="tasks sent" />
              <Milestone
                icon={Share2}
                value={average === null ? "—" : `${average}%`}
                label="average"
              />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

/**
 * The document, drawn rather than described. Locked until graduation, but never
 * hidden — a greyed-out certificate with your own name on it is a better
 * motivator than a padlock and a sentence.
 */
function CertificateCard({
  name,
  earned,
  certificate,
  journey,
}: {
  name: string;
  earned: boolean;
  certificate: IssuedCertificate | null;
  journey: StudentJourney;
}) {
  // The card reads as "unlocked" once the student has met the bar; the actual
  // download only appears once an admin has issued the file.
  const unlocked = certificate !== null || earned;

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div
        className={cn(
          "relative flex flex-col items-center gap-4 border-b border-border px-6 py-14 text-center",
          unlocked ? "bg-primary-pale" : "bg-secondary/50",
        )}
      >
        {!unlocked && (
          <Badge variant="outline" className="absolute right-5 top-5 bg-card">
            <Lock className="size-3.5" />
            Locked
          </Badge>
        )}

        <span
          className={cn(
            "flex size-14 items-center justify-center rounded-full",
            unlocked ? "bg-white text-primary" : "bg-card text-mute",
          )}
        >
          <Award className="size-7" />
        </span>

        <div className={cn(!unlocked && "opacity-60")}>
          <p className="text-xs uppercase tracking-widest text-mute">
            Certificate of completion
          </p>
          <p className="mt-2 font-display text-4xl font-extrabold tracking-tight text-ink">
            {name}
          </p>
          <p className="mt-2 text-sm text-body">
            60-day Spoken English Programme · English Dreams
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-body">
          {certificate
            ? `Issued on ${certificate.issuedAt}. Signed by your trainer and the programme director.`
            : earned
              ? "You've done everything required — your trainer is preparing your certificate."
              : `${TOTAL_TEACHING_DAYS - journey.daysCompleted} teaching days to go. Keep sending your tasks — your trainer signs this off.`}
        </p>

        <div className="flex shrink-0 gap-3">
          {certificate && certificate.downloadUrl ? (
            <Button asChild>
              <a href={certificate.downloadUrl} download>
                <Download />
                Download PDF
              </a>
            </Button>
          ) : certificate ? (
            <Button disabled>
              <Download />
              Download unavailable
            </Button>
          ) : earned ? (
            <Button variant="tertiary" disabled>
              <Share2 />
              Awaiting issue
            </Button>
          ) : (
            <Button asChild>
              <Link href="/student/learning-path">Continue the programme</Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function Milestone({
  icon: Icon,
  value,
  label,
}: {
  icon: LucideIcon;
  value: string;
  label: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-xl border border-border bg-card px-3 py-5 text-center">
      <Icon className="size-4 text-mute" />
      <span className="font-display text-2xl font-extrabold tabular-nums text-ink">
        {value}
      </span>
      <span className="text-xs text-mute">{label}</span>
    </div>
  );
}
