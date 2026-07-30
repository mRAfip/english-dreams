"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CreditCard,
  Loader2,
  Mail,
  Pencil,
  ShieldCheck,
  Trash2,
  UserRound,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  deleteStudent,
  setStudentAccess,
  updateStudent,
} from "@/lib/student/manage";
import type { FeeStatus, StudentRow } from "@/lib/student/directory";

// Admin > Students > detail — a single student's profile with edit and delete.
// Reads flow in from the server page; writes go through Server Actions and then
// a router refresh (edit) or a redirect back to the roster (delete).

type TrainerOption = { id: string; name: string };

export function StudentDetail({
  student,
  trainers,
}: {
  student: StudentRow;
  trainers: TrainerOption[];
}) {
  const router = useRouter();
  const [editOpen, setEditOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  return (
    <div>
      <Link
        href="/admin/students"
        className="inline-flex items-center gap-2 text-sm font-semibold text-body transition-colors hover:text-ink"
      >
        <ArrowLeft className="size-4" />
        All students
      </Link>

      {/* Header */}
      <header className="mt-4 flex flex-col gap-5 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-center gap-4">
          <Avatar className="size-14">
            {student.avatarUrl && <AvatarImage src={student.avatarUrl} alt="" />}
            <AvatarFallback>{initials(student.name)}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col gap-1.5">
            <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink">
              {student.name}
            </h1>
            <p className="text-sm text-body">{student.email}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Dialog open={editOpen} onOpenChange={setEditOpen}>
            <DialogTrigger asChild>
              <Button variant="secondary">
                <Pencil />
                Edit
              </Button>
            </DialogTrigger>
            <EditStudentDialog
              student={student}
              trainers={trainers}
              onDone={() => {
                setEditOpen(false);
                router.refresh();
              }}
            />
          </Dialog>

          <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" className="text-destructive hover:text-destructive">
                <Trash2 />
                Delete
              </Button>
            </DialogTrigger>
            <DeleteStudentDialog
              student={student}
              onDeleted={() => {
                setDeleteOpen(false);
                router.push("/admin/students");
                router.refresh();
              }}
            />
          </Dialog>
        </div>
      </header>

      {/* Profile */}
      <section className="mt-6" aria-label="Profile">
        <h2 className="text-sm font-semibold text-ink">Profile</h2>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2">
          <DetailField icon={UserRound} label="Trainer">
            {student.trainerName ? (
              student.trainerName
            ) : (
              <span className="text-mute">Unassigned</span>
            )}
          </DetailField>
          <DetailField icon={Mail} label="Email">
            {student.email}
          </DetailField>
          <DetailField icon={UserRound} label="Role">
            <Badge variant="positive">Student</Badge>
          </DetailField>
          <DetailField icon={UserRound} label="Joined">
            {student.joinedAt}
          </DetailField>
        </dl>
      </section>

      {/* Access & fees */}
      <AccessFeesSection student={student} />
    </div>
  );
}

const FEE_LABEL: Record<FeeStatus, string> = {
  paid: "Paid",
  unpaid: "Unpaid",
  waived: "Waived",
};

const FEE_VARIANT: Record<FeeStatus, "positive" | "warning" | "neutral"> = {
  paid: "positive",
  unpaid: "warning",
  waived: "neutral",
};

/**
 * The access toggle + fee status control. Each control persists IMMEDIATELY via
 * setStudentAccess — no separate Save step, so what the admin sees is always
 * what's in the database. Local state is optimistic and reverts on error, and
 * the outcome is announced with a toast.
 */
function AccessFeesSection({ student }: { student: StudentRow }) {
  const router = useRouter();
  const [accessEnabled, setAccessEnabled] = React.useState(
    student.accessEnabled,
  );
  const [feeStatus, setFeeStatus] = React.useState<FeeStatus>(student.feeStatus);
  const [pending, setPending] = React.useState<null | "access" | "fee">(null);

  // Persist one change immediately. Optimistically applies `next`, calls the
  // action, rolls back to `prev` on failure, and toasts either way.
  async function persist(
    field: "access" | "fee",
    next: { accessEnabled: boolean; feeStatus: FeeStatus },
    prev: { accessEnabled: boolean; feeStatus: FeeStatus },
    successMessage: string,
  ) {
    setPending(field);
    setAccessEnabled(next.accessEnabled);
    setFeeStatus(next.feeStatus);
    try {
      const result = await setStudentAccess({
        id: student.id,
        accessEnabled: next.accessEnabled,
        feeStatus: next.feeStatus,
      });
      if (result.ok) {
        toast.success(successMessage);
        router.refresh();
      } else {
        setAccessEnabled(prev.accessEnabled);
        setFeeStatus(prev.feeStatus);
        toast.error("Couldn't save changes", { description: result.error });
      }
    } catch (e) {
      setAccessEnabled(prev.accessEnabled);
      setFeeStatus(prev.feeStatus);
      toast.error("Couldn't save changes", {
        description: e instanceof Error ? e.message : "Something went wrong.",
      });
    } finally {
      setPending(null);
    }
  }

  const busy = pending !== null;

  function toggleAccess(nextEnabled: boolean) {
    const prev = { accessEnabled, feeStatus };
    persist(
      "access",
      { accessEnabled: nextEnabled, feeStatus },
      prev,
      nextEnabled
        ? `${student.name}'s access is enabled`
        : `${student.name}'s access is disabled`,
    );
  }

  function changeFee(next: FeeStatus) {
    const prev = { accessEnabled, feeStatus };
    persist(
      "fee",
      { accessEnabled, feeStatus: next },
      prev,
      `Fee status set to ${FEE_LABEL[next].toLowerCase()}`,
    );
  }

  return (
    <section className="mt-8" aria-label="Access and fees">
      <h2 className="text-sm font-semibold text-ink">Access &amp; fees</h2>
      <p className="mt-1 text-xs text-mute">Changes save automatically.</p>
      <div className="mt-3 rounded-xl border border-border bg-card p-4 sm:p-5">
        <div className="flex flex-col gap-5">
          {/* Access toggle */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-mute" />
              <div>
                <div id="student-access-label" className="text-sm font-medium text-ink">
                  Student access
                </div>
                <p className="mt-0.5 text-xs text-mute">
                  {accessEnabled
                    ? "The student can sign in and use the dashboard."
                    : "The student is blocked at login and sent to the suspended screen."}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <span
                className={
                  accessEnabled
                    ? "text-xs font-semibold text-positive-deep"
                    : "text-xs font-semibold text-destructive"
                }
              >
                {accessEnabled ? "Enabled" : "Disabled"}
              </span>
              {pending === "access" ? (
                <Loader2 className="size-4 animate-spin text-mute" />
              ) : null}
              <Switch
                checked={accessEnabled}
                onCheckedChange={toggleAccess}
                disabled={busy}
                aria-labelledby="student-access-label"
              />
            </div>
          </div>

          {/* Fee status */}
          <div className="flex flex-col gap-2 border-t border-border pt-5">
            <div className="flex items-center gap-3">
              <CreditCard className="size-4 shrink-0 text-mute" />
              <Label htmlFor="fee-status" className="text-sm font-medium text-ink">
                Fee status
              </Label>
              <Badge variant={FEE_VARIANT[feeStatus]}>
                {FEE_LABEL[feeStatus]}
              </Badge>
              {pending === "fee" ? (
                <Loader2 className="size-4 animate-spin text-mute" />
              ) : null}
            </div>
            <select
              id="fee-status"
              value={feeStatus}
              onChange={(e) => changeFee(e.target.value as FeeStatus)}
              disabled={busy}
              className="h-11 w-full rounded-md border border-input bg-card px-4 text-sm text-foreground shadow-sm transition-colors focus-visible:border-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-60 sm:max-w-xs"
            >
              <option value="unpaid">Unpaid</option>
              <option value="paid">Paid</option>
              <option value="waived">Waived</option>
            </select>
          </div>
        </div>
      </div>
    </section>
  );
}

function DetailField({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof UserRound;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-border bg-card px-4 py-3.5">
      <Icon className="mt-0.5 size-4 shrink-0 text-mute" />
      <div className="min-w-0">
        <dt className="text-xs text-mute">{label}</dt>
        <dd className="mt-0.5 text-sm font-medium text-ink">{children}</dd>
      </div>
    </div>
  );
}

/** Edit form. Its own component so state resets when the dialog closes. */
function EditStudentDialog({
  student,
  trainers,
  onDone,
}: {
  student: StudentRow;
  trainers: TrainerOption[];
  onDone: () => void;
}) {
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const trainerId = String(form.get("trainerId") ?? "");
    if (!name || !email) return;

    setPending(true);
    setError(null);
    try {
      const result = await updateStudent({
        id: student.id,
        name,
        email,
        password: password || undefined,
        trainerId: trainerId || null,
      });
      if (result.ok) {
        onDone();
      } else {
        setError(result.error);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setPending(false);
    }
  }

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Edit student</DialogTitle>
        <DialogDescription>
          Update the student&apos;s details. Leave the password blank to keep
          their current one.
        </DialogDescription>
      </DialogHeader>

      <form id="edit-student" onSubmit={handleSubmit} className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="edit-student-name">Full name</Label>
          <Input
            id="edit-student-name"
            name="name"
            defaultValue={student.name}
            required
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="edit-student-email">Email</Label>
          <Input
            id="edit-student-email"
            name="email"
            type="email"
            defaultValue={student.email}
            required
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="edit-student-password">New password</Label>
          <Input
            id="edit-student-password"
            name="password"
            type="text"
            minLength={6}
            placeholder="Leave blank to keep current"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="edit-student-trainer">Trainer</Label>
          <select
            id="edit-student-trainer"
            name="trainerId"
            defaultValue={student.trainerId ?? ""}
            className="h-11 w-full rounded-md border border-input bg-card px-4 text-sm text-foreground shadow-sm transition-colors focus-visible:border-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <option value="">Unassigned</option>
            {trainers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          {trainers.length === 0 ? (
            <p className="text-xs text-mute">
              No trainers yet — add one from the Trainers page to assign here.
            </p>
          ) : null}
        </div>
        {error ? (
          <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}
      </form>

      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="secondary" disabled={pending}>
            Cancel
          </Button>
        </DialogClose>
        <Button type="submit" form="edit-student" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : <Pencil />}
          Save changes
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

/** Delete confirmation. Removes the account and everything that cascades from it. */
function DeleteStudentDialog({
  student,
  onDeleted,
}: {
  student: StudentRow;
  onDeleted: () => void;
}) {
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleDelete() {
    setPending(true);
    setError(null);
    try {
      const result = await deleteStudent({ id: student.id });
      if (result.ok) {
        onDeleted();
      } else {
        setError(result.error);
        setPending(false);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setPending(false);
    }
  }

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Delete student</DialogTitle>
        <DialogDescription>
          This permanently removes {student.name}&apos;s account, profile and
          trainer assignment. This can&apos;t be undone.
        </DialogDescription>
      </DialogHeader>

      {error ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="secondary" disabled={pending}>
            Cancel
          </Button>
        </DialogClose>
        <Button
          type="button"
          variant="destructive"
          onClick={handleDelete}
          disabled={pending}
        >
          {pending ? <Loader2 className="animate-spin" /> : <Trash2 />}
          Delete student
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}
