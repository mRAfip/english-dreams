import { requireRole } from "@/lib/auth/guards";

// Admin section — server-side role gate. A signed-in non-admin is sent to
// their own dashboard; a signed-out visitor to /login.
// Nav config / chrome still to come.
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRole("admin");
  return <>{children}</>;
}
