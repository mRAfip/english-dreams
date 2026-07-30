"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, Loader2, Plus, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DirectoryFilters,
  DirectoryToolbar,
  SearchField,
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
import { createStudent, setStudentAccess } from "@/lib/student/manage";
import type { FeeStatus, StudentRow } from "@/lib/student/directory";

// Admin > Students — the real roster, read from profiles + role assignments,
// each with the trainer they're assigned to. "Add student" provisions an account
// (auth user + student role + trainer link) via a Server Action.

type TrainerOption = { id: string; name: string };

const FEE_LABEL: Record<FeeStatus, string> = {
  paid: "Fees paid",
  unpaid: "Fees due",
  waived: "Fees waived",
};

const FEE_VARIANT: Record<FeeStatus, "positive" | "warning" | "neutral"> = {
  paid: "positive",
  unpaid: "warning",
  waived: "neutral",
};

export function StudentDirectory({
  students,
  trainers,
}: {
  students: StudentRow[];
  trainers: TrainerOption[];
}) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [addOpen, setAddOpen] = React.useState(false);

  const q = query.trim().toLowerCase();
  const visible = q
    ? students.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.email.toLowerCase().includes(q) ||
          (s.trainerName?.toLowerCase().includes(q) ?? false),
      )
    : students;

  return (
    <div>
      {/* Header */}
      <header className="flex flex-col gap-5 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1.5">
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink">
            Students
          </h1>
          <p className="text-sm text-body">
            {students.length} {students.length === 1 ? "student" : "students"}{" "}
            enrolled
          </p>
        </div>

        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button className="self-start sm:self-auto">
              <Plus />
              Add student
            </Button>
          </DialogTrigger>
          <AddStudentDialog
            trainers={trainers}
            onDone={() => {
              setAddOpen(false);
              router.refresh();
            }}
          />
        </Dialog>
      </header>

      {/* Search */}
      <div className="mt-6">
        <DirectoryToolbar>
          <div />
          <DirectoryFilters>
            <SearchField
              value={query}
              onChange={setQuery}
              placeholder="Search students"
              label="Search students"
            />
          </DirectoryFilters>
        </DirectoryToolbar>
      </div>

      <div className="mt-4">
        {visible.length === 0 ? (
          <TableEmpty
            icon={Users}
            message={
              students.length === 0
                ? "No students yet. Add your first student to get started."
                : "No students match your search."
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Student</TableHead>
                <TableHead className="hidden sm:table-cell">Email</TableHead>
                <TableHead className="hidden md:table-cell">Trainer</TableHead>
                <TableHead className="hidden lg:table-cell">Joined</TableHead>
                <TableHead className="text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((s) => (
                <TableRow
                  key={s.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/admin/students/${s.id}`)}
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar>
                        {s.avatarUrl && <AvatarImage src={s.avatarUrl} alt="" />}
                        <AvatarFallback>{initials(s.name)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <Link
                          href={`/admin/students/${s.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="font-semibold text-ink hover:underline"
                        >
                          {s.name}
                        </Link>
                        <div className="text-xs text-mute sm:hidden">
                          {s.email}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden text-body sm:table-cell">
                    {s.email}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {s.trainerName ? (
                      s.trainerName
                    ) : (
                      <span className="text-mute">Unassigned</span>
                    )}
                  </TableCell>
                  <TableCell className="hidden text-mute lg:table-cell">
                    {s.joinedAt}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-3">
                      <Badge variant={FEE_VARIANT[s.feeStatus]}>
                        {FEE_LABEL[s.feeStatus]}
                      </Badge>
                      <AccessToggle student={s} />
                      <ChevronRight className="size-4 text-mute" />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}

/** The add-student form. Its own component so state resets when the dialog closes. */
function AddStudentDialog({
  trainers,
  onDone,
}: {
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
      const result = await createStudent({
        name,
        email,
        password,
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
        <DialogTitle>Add student</DialogTitle>
        <DialogDescription>
          Creates a confirmed account, assigns the student role, and links them
          to a trainer. Share the password — they can change it after signing in.
        </DialogDescription>
      </DialogHeader>

      <form id="add-student" onSubmit={handleSubmit} className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="student-name">Full name</Label>
          <Input
            id="student-name"
            name="name"
            placeholder="Priya Nair"
            required
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="student-email">Email</Label>
          <Input
            id="student-email"
            name="email"
            type="email"
            placeholder="priya@example.com"
            required
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="student-password">Temporary password</Label>
          <Input
            id="student-password"
            name="password"
            type="text"
            minLength={6}
            placeholder="At least 6 characters"
            required
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="student-trainer">Trainer</Label>
          <select
            id="student-trainer"
            name="trainerId"
            defaultValue=""
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
        <Button type="submit" form="add-student" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : <Plus />}
          Add student
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

/**
 * Inline access toggle for a roster row. Persists immediately via
 * setStudentAccess (optimistic, reverts on error) and toasts the outcome.
 * Clicks are stopped from bubbling so flipping the switch doesn't open the row.
 */
function AccessToggle({ student }: { student: StudentRow }) {
  const router = useRouter();
  const [enabled, setEnabled] = React.useState(student.accessEnabled);
  const [pending, setPending] = React.useState(false);

  async function handleChange(next: boolean) {
    setPending(true);
    setEnabled(next);
    try {
      const result = await setStudentAccess({
        id: student.id,
        accessEnabled: next,
        feeStatus: student.feeStatus,
      });
      if (result.ok) {
        toast.success(
          next
            ? `${student.name}'s access is enabled`
            : `${student.name}'s access is disabled`,
        );
        router.refresh();
      } else {
        setEnabled(!next);
        toast.error("Couldn't update access", { description: result.error });
      }
    } catch (e) {
      setEnabled(!next);
      toast.error("Couldn't update access", {
        description: e instanceof Error ? e.message : "Something went wrong.",
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <span
      className="flex items-center gap-2"
      onClick={(e) => e.stopPropagation()}
    >
      <span className="hidden text-xs font-medium text-mute sm:inline">
        {enabled ? "Access" : "Disabled"}
      </span>
      {pending ? <Loader2 className="size-3.5 animate-spin text-mute" /> : null}
      <Switch
        checked={enabled}
        onCheckedChange={handleChange}
        disabled={pending}
        aria-label={`${enabled ? "Disable" : "Enable"} access for ${student.name}`}
      />
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
