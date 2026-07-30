import Link from "next/link";
import { redirect } from "next/navigation";
import { LockKeyhole } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/guards";
import { homeFor } from "@/lib/auth/roles";
import { Button } from "@/components/ui/button";
import { SignOutButton } from "@/components/global/sign-out-button";

// Shown to a student whose access an admin has disabled (payment pending).
// Deliberately kept OUTSIDE the (dashboard)/student chrome so it doesn't render
// nav that would just redirect back here. Anyone who still has access is sent to
// their own dashboard. The copy speaks to students, not billing — it never says
// "payment required" outright.
export default async function Page() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.accessEnabled) redirect(homeFor(user.role));

  return (
    <main className="grid min-h-dvh place-items-center bg-background px-6 py-16">
      <div className="w-full max-w-md text-center">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-warning/20 text-warning-deep">
          <LockKeyhole className="size-6" />
        </span>
        <h1 className="mt-6 font-display text-2xl font-extrabold tracking-tight text-ink">
          Your account is temporarily disabled
        </h1>
        <p className="mt-3 text-sm text-body">
          We haven&apos;t received your latest payment yet, so your English
          Dreams account has been paused for now. As soon as your payment is
          confirmed, your access will be switched back on.
        </p>
        <p className="mt-3 text-sm text-body">
          Please get in touch with the{" "}
          <span className="font-semibold text-ink">
            English Dreams support team
          </span>{" "}
          and they&apos;ll help you sort this out.
        </p>

        <div className="mt-8 flex flex-col items-center gap-4">
          <Button asChild>
            <Link href="/support">Contact support</Link>
          </Button>
          <SignOutButton />
        </div>
      </div>
    </main>
  );
}
