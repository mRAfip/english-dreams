"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { homeFor, resolveRole } from "@/lib/auth/roles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogoMark } from "@/components/global/logo";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.26 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z"
      />
    </svg>
  );
}

/**
 * Supabase surfaces 5xx responses with an empty or JSON-blob message, which
 * renders as a useless "{}" in the error box. Fall back to something a user
 * can act on, and keep the raw detail in the console for us.
 */
function authMessage(error: { message?: string; status?: number } | null) {
  const raw = error?.message?.trim();
  if (error) console.error("[login]", error);
  if (!raw || raw === "{}" || raw.startsWith("{")) {
    return "Sign-in is temporarily unavailable. Please try again, or contact support if it persists.";
  }
  return raw;
}

export function LoginForm({
  next,
  initialError,
}: {
  next: string | null;
  initialError?: string | null;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState<"password" | "google" | null>(null);
  const [error, setError] = useState<string | null>(initialError ?? null);

  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading("password");
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error || !data.user) {
      setError(authMessage(error));
      setLoading(null);
      return;
    }

    // Route by the role in user_role_assignments. An account with no
    // assignment can authenticate but has nowhere to go — don't leave it
    // holding a session.
    const role = await resolveRole(supabase, data.user.id);
    if (!role) {
      await supabase.auth.signOut();
      setError(
        "This account has no role assigned yet. Ask your administrator to set one up.",
      );
      setLoading(null);
      return;
    }

    // A student an admin has disabled (payment pending) may authenticate but
    // can't use the app. The access-check endpoint answers 402 for a disabled
    // student; keep the session — the /suspended screen needs it to show them
    // who they are and offer sign-out — and route them there.
    if (role === "student") {
      const check = await fetch("/api/student-access");
      if (check.status === 402) {
        router.push("/suspended");
        router.refresh();
        return;
      }
    }

    router.push(next ?? homeFor(role));
    router.refresh();
  }

  async function handleGoogle() {
    setError(null);
    setLoading("google");
    // No `next` -> the callback resolves the role and picks the dashboard.
    const callback = new URL("/auth/callback", window.location.origin);
    if (next) callback.searchParams.set("next", next);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callback.toString() },
    });
    if (error) {
      setError(error.message);
      setLoading(null);
    }
  }

  const busy = loading !== null;

  return (
    <div className="flex flex-col items-center text-center">
      <LogoMark className="size-11" />
      <h1 className="mt-6 font-display text-2xl font-extrabold tracking-tight text-ink">
        Sign in to English Dreams
      </h1>
      <p className="mt-2 text-sm text-mute">
        Use the account your administrator created for you.
      </p>

      <div className="mt-8 w-full space-y-3">
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={handleGoogle}
          disabled={busy}
        >
          {loading === "google" ? (
            <Loader2 className="animate-spin" />
          ) : (
            <GoogleIcon />
          )}
          Continue with Google
        </Button>
      </div>

      <div className="my-6 flex w-full items-center gap-4">
        <span className="h-px flex-1 bg-border" />
        <span className="text-xs text-mute">or</span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <form onSubmit={handlePasswordLogin} className="w-full space-y-4 text-left">
        <div className="space-y-2">
          <Label htmlFor="email">Enter your email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="name@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Enter your password</Label>
            <Link
              href="/forgot-password"
              className="text-sm text-mute hover:text-ink"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pr-11"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-mute hover:text-ink"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <EyeOff className="size-5" />
              ) : (
                <Eye className="size-5" />
              )}
            </button>
          </div>
        </div>

        {error && (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}
        <Button type="submit" className="w-full" disabled={busy}>
          {loading === "password" && <Loader2 className="animate-spin" />}
          Continue
        </Button>
      </form>

      <p className="mt-6 text-xs leading-5 text-mute">
        By signing in, you agree to the{" "}
        <Link href="/terms" className="underline hover:text-ink">
          Terms of Service
        </Link>{" "}
        and{" "}
        <Link href="/privacy" className="underline hover:text-ink">
          Privacy Policy
        </Link>
        .
      </p>

      <p className="mt-8 text-sm text-mute">
        Need help?{" "}
        <Link
          href="/support"
          className="font-semibold text-brand-green hover:underline"
        >
          Contact support
        </Link>
      </p>
    </div>
  );
}
