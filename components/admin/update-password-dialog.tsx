"use client";

import * as React from "react";
import { KeyRound, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/toast";
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { adminResetUserPassword } from "@/lib/student/manage";

export function UpdatePasswordDialog({
  userId,
  userName,
  onDone,
}: {
  userId: string;
  userName: string;
  onDone: () => void;
}) {
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "").trim();
    if (!password) return;

    setPending(true);
    setError(null);
    try {
      const result = await adminResetUserPassword({
        userId,
        password,
      });
      if (result.ok) {
        toast.success(`Password updated for ${userName}`);
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
        <DialogTitle>Update password</DialogTitle>
        <DialogDescription>
          Set a new password for {userName}.
        </DialogDescription>
      </DialogHeader>

      <form id="update-password-form" onSubmit={handleSubmit} className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="update-password-field">New password</Label>
          <Input
            id="update-password-field"
            name="password"
            type="text"
            minLength={6}
            required
            placeholder="Enter at least 6 characters"
            autoFocus
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
        <Button type="submit" form="update-password-form" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : <KeyRound className="size-4" />}
          Update password
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
