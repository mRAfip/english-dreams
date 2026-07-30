"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "@/components/ui/toast";
import { SignOutButton } from "@/components/global/sign-out-button";
import { ROLE_LABEL } from "@/lib/auth/roles";
import {
  requestAvatarUploadUrl,
  saveAvatar,
  updatePassword,
  updateProfileName,
} from "@/lib/profile/actions";
import type { CurrentUser } from "@/lib/auth/guards";

// Shared > Profile — account settings, common to all roles. Name and photo write
// to the user's own profiles row; password goes through Supabase Auth. Email is
// the login identity and is read-only here.

export function ProfileSettings({
  user,
  avatarsEnabled,
}: {
  user: CurrentUser;
  avatarsEnabled: boolean;
}) {
  return (
    <div>
      <header className="flex flex-col gap-5 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1.5">
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink">
            Profile
          </h1>
          <p className="text-sm text-body">Your account details.</p>
        </div>
        <SignOutButton />
      </header>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Card
            title="Account"
            description="Your name is what students and trainers see on messages."
          >
            <AvatarField user={user} avatarsEnabled={avatarsEnabled} />
            <NameForm user={user} />
          </Card>

          <Card
            title="Password"
            description="Use at least 8 characters, mixing letters and numbers."
          >
            <PasswordForm />
          </Card>
        </div>

        <aside className="flex flex-col gap-6">
          <Card title="Role" description="Set by an admin — you can't change it here.">
            <Badge variant="brand">{ROLE_LABEL[user.role]}</Badge>
          </Card>

          <Card title="Email" description="Your sign-in address.">
            <p className="text-sm font-medium text-ink">{user.email}</p>
            <p className="mt-1 text-xs text-mute">
              Contact an admin to change your email.
            </p>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function AvatarField({
  user,
  avatarsEnabled,
}: {
  user: CurrentUser;
  avatarsEnabled: boolean;
}) {
  const router = useRouter();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState(false);

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Photo too large", { description: "Keep it under 2 MB." });
      return;
    }

    setBusy(true);
    try {
      const { key, uploadUrl } = await requestAvatarUploadUrl({
        fileName: file.name,
      });
      const put = await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: file.type ? { "Content-Type": file.type } : undefined,
      });
      if (!put.ok) throw new Error(`Upload failed (${put.status})`);

      const result = await saveAvatar({ key });
      if (!result.ok) throw new Error(result.error);

      toast.success("Photo updated");
      router.refresh();
    } catch (err) {
      toast.error("Couldn't update photo", {
        description: err instanceof Error ? err.message : "Something went wrong.",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-4">
      <Avatar className="size-16">
        {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt="" />}
        <AvatarFallback className="text-lg">{initials(user)}</AvatarFallback>
      </Avatar>
      <div className="flex flex-col gap-1.5">
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="sr-only"
          onChange={handleFile}
          disabled={busy || !avatarsEnabled}
        />
        <Button
          type="button"
          variant="tertiary"
          size="sm"
          disabled={busy || !avatarsEnabled}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? <Loader2 className="animate-spin" /> : <Upload />}
          {busy ? "Uploading…" : "Change photo"}
        </Button>
        <span className="text-xs text-mute">
          {avatarsEnabled
            ? "JPG, PNG or WebP, up to 2 MB."
            : "Photo uploads aren't available right now."}
        </span>
      </div>
    </div>
  );
}

function NameForm({ user }: { user: CurrentUser }) {
  const router = useRouter();
  const [fullName, setFullName] = React.useState(user.fullName ?? "");
  const [pending, setPending] = React.useState(false);

  const dirty = fullName.trim() !== (user.fullName ?? "").trim();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!dirty) return;
    setPending(true);
    try {
      const result = await updateProfileName({ fullName });
      if (result.ok) {
        toast.success("Profile updated");
        router.refresh();
      } else {
        toast.error("Couldn't save", { description: result.error });
      }
    } catch (e) {
      toast.error("Couldn't save", {
        description: e instanceof Error ? e.message : "Something went wrong.",
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 grid gap-4 sm:grid-cols-2">
      <div className="grid gap-2">
        <Label htmlFor="full-name">Full name</Label>
        <Input
          id="full-name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Your name"
          maxLength={80}
          required
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="email">Email</Label>
        {/* Email is the login identity — changing it needs re-verification. */}
        <Input id="email" value={user.email} readOnly disabled />
      </div>
      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending || !dirty}>
          {pending ? <Loader2 className="animate-spin" /> : null}
          Save changes
        </Button>
      </div>
    </form>
  );
}

function PasswordForm() {
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [pending, setPending] = React.useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password.length < 8) {
      toast.error("Password too short", {
        description: "Use at least 8 characters.",
      });
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords don't match");
      return;
    }

    setPending(true);
    try {
      const result = await updatePassword({ password });
      if (result.ok) {
        toast.success("Password updated");
        setPassword("");
        setConfirm("");
      } else {
        toast.error("Couldn't update password", { description: result.error });
      }
    } catch (e) {
      toast.error("Couldn't update password", {
        description: e instanceof Error ? e.message : "Something went wrong.",
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
      <div className="grid gap-2">
        <Label htmlFor="new-password">New password</Label>
        <Input
          id="new-password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={8}
          required
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="confirm-password">Confirm password</Label>
        <Input
          id="confirm-password"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          minLength={8}
          required
        />
      </div>
      <div className="sm:col-span-2">
        <Button type="submit" variant="tertiary" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : <KeyRound />}
          Update password
        </Button>
      </div>
    </form>
  );
}

function Card({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-card p-6">
      <h2 className="font-display text-lg font-extrabold text-ink">{title}</h2>
      <p className="mt-1 text-sm text-body">{description}</p>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function initials(user: CurrentUser): string {
  const source = user.fullName?.trim() || user.email;
  const parts = source.split(/[\s@._-]+/).filter(Boolean);
  return (parts[0]?.[0] ?? "?").concat(parts[1]?.[0] ?? "").toUpperCase();
}
