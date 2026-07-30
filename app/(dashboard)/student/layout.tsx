import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/guards";

// Student section — server-side role gate + access check.
// A student an admin has suspended (student_access.access_enabled = false) is
// bounced to /suspended instead of the learning dashboard.
// Nav config / chrome still to come.
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireRole("student");
  if (!user.accessEnabled) redirect("/suspended");
  return <>{children}</>;
}
