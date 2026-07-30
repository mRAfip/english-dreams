"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, GraduationCap, Loader2, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { createTrainer } from "@/lib/trainer/actions";
import type { TrainerRow } from "@/lib/trainer/directory";

// Admin > Trainers — the real team, read from the profiles + role-assignment
// tables. "Add trainer" provisions an account (auth user + profile + trainer
// role) via a Server Action, then the list refreshes.

export function TrainerDirectory({ trainers }: { trainers: TrainerRow[] }) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [addOpen, setAddOpen] = React.useState(false);

  const q = query.trim().toLowerCase();
  const visible = q
    ? trainers.filter(
        (t) =>
          t.name.toLowerCase().includes(q) || t.email.toLowerCase().includes(q),
      )
    : trainers;

  return (
    <div>
      {/* Header */}
      <header className="flex flex-col gap-5 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1.5">
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink">
            Trainers
          </h1>
          <p className="text-sm text-body">
            {trainers.length} {trainers.length === 1 ? "trainer" : "trainers"}{" "}
            on the team
          </p>
        </div>

        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button className="self-start sm:self-auto">
              <Plus />
              Add trainer
            </Button>
          </DialogTrigger>
          <AddTrainerDialog
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
              placeholder="Search trainers"
              label="Search trainers"
            />
          </DirectoryFilters>
        </DirectoryToolbar>
      </div>

      <div className="mt-4">
        {visible.length === 0 ? (
          <TableEmpty
            icon={GraduationCap}
            message={
              trainers.length === 0
                ? "No trainers yet. Add your first trainer to get started."
                : "No trainers match your search."
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Trainer</TableHead>
                <TableHead className="hidden sm:table-cell">Email</TableHead>
                <TableHead className="hidden lg:table-cell">Joined</TableHead>
                <TableHead className="text-right">Role</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((t) => (
                <TableRow
                  key={t.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/admin/trainers/${t.id}`)}
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar>
                        {t.avatarUrl && <AvatarImage src={t.avatarUrl} alt="" />}
                        <AvatarFallback>{initials(t.name)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <Link
                          href={`/admin/trainers/${t.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="font-semibold text-ink hover:underline"
                        >
                          {t.name}
                        </Link>
                        <div className="text-xs text-mute sm:hidden">
                          {t.email}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden text-body sm:table-cell">
                    {t.email}
                  </TableCell>
                  <TableCell className="hidden text-mute lg:table-cell">
                    {t.joinedAt}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Badge variant="positive">Trainer</Badge>
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

/** The add-trainer form. Its own component so state resets when the dialog closes. */
function AddTrainerDialog({ onDone }: { onDone: () => void }) {
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
      const result = await createTrainer({ name, email, password });
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
        <DialogTitle>Add trainer</DialogTitle>
        <DialogDescription>
          Creates a confirmed account and assigns the trainer role. Share the
          password with them — they can change it after signing in.
        </DialogDescription>
      </DialogHeader>

      <form id="add-trainer" onSubmit={handleSubmit} className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="trainer-name">Full name</Label>
          <Input
            id="trainer-name"
            name="name"
            placeholder="Nadia Rahman"
            required
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="trainer-email">Work email</Label>
          <Input
            id="trainer-email"
            name="email"
            type="email"
            placeholder="nadia@englishdreams.com"
            required
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="trainer-password">Temporary password</Label>
          <Input
            id="trainer-password"
            name="password"
            type="text"
            minLength={6}
            placeholder="At least 6 characters"
            required
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
        <Button type="submit" form="add-trainer" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : <Plus />}
          Add trainer
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
