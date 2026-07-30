import { LoginForm } from "./login-form";

const ERRORS: Record<string, string> = {
  auth_callback_failed: "Sign-in failed. Please try again.",
  no_role:
    "This account has no role assigned yet. Ask your administrator to set one up.",
};

// Login page — passes through the `next` redirect target when one was supplied
// (e.g. by the proxy on a protected route). With no `next`, the form routes by
// the user's role after sign-in.
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  const safeNext = next && next.startsWith("/") ? next : null;
  return (
    <LoginForm
      next={safeNext}
      initialError={error ? (ERRORS[error] ?? null) : null}
    />
  );
}
