import { requireRole } from "@/lib/auth/guards";

// Trainer section — server-side role gate.
// Nav config / chrome still to come.
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRole("trainer");
  return <>{children}</>;
}
