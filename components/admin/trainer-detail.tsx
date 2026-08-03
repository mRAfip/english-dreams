"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  GraduationCap,
  KeyRound,
  Loader2,
  Mail,
  Pencil,
  Trash2,
  UserRound,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { deleteTrainer, updateTrainer } from "@/lib/trainer/actions";
import { UpdatePasswordDialog } from "@/components/admin/update-password-dialog";
import type { TrainerDetail as TrainerDetailData } from "@/lib/trainer/directory";

// Admin > Trainers > detail — a single trainer's profile with edit and delete.
// Reads flow in from the server page; writes go through Server Actions and then
// a router refresh (edit) or a redirect back to the roster (delete).

export function TrainerDetail({ trainer }: { trainer: TrainerDetailData }) {
  const router = useRouter();
  const [editOpen, setEditOpen] = React.useState(false);
  const [passwordOpen, setPasswordOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  return (
    <div>
      <Link
        href="/admin/trainers"
        className="inline-flex items-center gap-2 text-sm font-semibold text-body transition-colors hover:text-ink"
      >
        <ArrowLeft className="size-4" />
        All trainers
      </Link>

      {/* Header */}
      <header className="mt-4 flex flex-col gap-5 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-center gap-4">
          <Avatar className="size-14">
            {trainer.avatarUrl && <AvatarImage src={trainer.avatarUrl} alt="" />}
            <AvatarFallback>{initials(trainer.name)}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col gap-1.5">
            <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink">
              {trainer.name}
            </h1>
            <p className="text-sm text-body">{trainer.email}</p>
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
            <EditTrainerDialog
              trainer={trainer}
              onDone={() => {
                setEditOpen(false);
                router.refresh();
              }}
            />
          </Dialog>

          <Dialog open={passwordOpen} onOpenChange={setPasswordOpen}>
            <DialogTrigger asChild>
              <Button variant="secondary">
                <KeyRound className="size-4" />
                Password
              </Button>
            </DialogTrigger>
            <UpdatePasswordDialog
              userId={trainer.id}
              userName={trainer.name}
              onDone={() => setPasswordOpen(false)}
            />
          </Dialog>

          <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" className="text-destructive hover:text-destructive">
                <Trash2 />
                Delete
              </Button>
            </DialogTrigger>
            <DeleteTrainerDialog
              trainer={trainer}
              onDeleted={() => {
                setDeleteOpen(false);
                router.push("/admin/trainers");
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
          <DetailField icon={Mail} label="Email">
            {trainer.email}
          </DetailField>
          <DetailField icon={Users} label="Students assigned">
            {trainer.studentCount}{" "}
            {trainer.studentCount === 1 ? "student" : "students"}
          </DetailField>
          <DetailField icon={UserRound} label="Role">
            <Badge variant="positive">Trainer</Badge>
          </DetailField>
          <DetailField icon={GraduationCap} label="Joined">
            {trainer.joinedAt}
          </DetailField>
        </dl>
      </section>
    </div>
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
function EditTrainerDialog({
  trainer,
  onDone,
}: {
  trainer: TrainerDetailData;
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
    if (!name || !email) return;

    setPending(true);
    setError(null);
    try {
      const result = await updateTrainer({
        id: trainer.id,
        name,
        email,
        password: password || undefined,
      });
      if (result.ok) {
        toast.success("Trainer updated");
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
        <DialogTitle>Edit trainer</DialogTitle>
        <DialogDescription>
          Update the trainer&apos;s details. Leave the password blank to keep
          their current one.
        </DialogDescription>
      </DialogHeader>

      <form id="edit-trainer" onSubmit={handleSubmit} className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="edit-trainer-name">Full name</Label>
          <Input
            id="edit-trainer-name"
            name="name"
            defaultValue={trainer.name}
            required
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="edit-trainer-email">Work email</Label>
          <Input
            id="edit-trainer-email"
            name="email"
            type="email"
            defaultValue={trainer.email}
            required
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="edit-trainer-password">New password</Label>
          <Input
            id="edit-trainer-password"
            name="password"
            type="text"
            minLength={6}
            placeholder="Leave blank to keep current"
          />
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
        <Button type="submit" form="edit-trainer" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : <Pencil />}
          Save changes
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

/** Delete confirmation. Removes the account; assigned students become unassigned. */
function DeleteTrainerDialog({
  trainer,
  onDeleted,
}: {
  trainer: TrainerDetailData;
  onDeleted: () => void;
}) {
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleDelete() {
    setPending(true);
    setError(null);
    try {
      const result = await deleteTrainer({ id: trainer.id });
      if (result.ok) {
        toast.success(`${trainer.name} removed`);
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
        <DialogTitle>Delete trainer</DialogTitle>
        <DialogDescription>
          This permanently removes {trainer.name}&apos;s account.{" "}
          {trainer.studentCount > 0
            ? `${trainer.studentCount} ${
                trainer.studentCount === 1 ? "student" : "students"
              } assigned to them will become unassigned.`
            : "No students are assigned to them."}{" "}
          This can&apos;t be undone.
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
          Delete trainer
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
