import { cookies } from "next/headers";
import { requireUser } from "@/lib/auth/guards";
import {
  SIDEBAR_COOKIE,
  SidebarShell,
} from "@/components/global/sidebar-shell";

// (dashboard) shell layout — the authenticated chrome shared by ALL roles.
// Auth gate here is "any signed-in, role-assigned user"; the nested admin/
// trainer/ student/ layouts narrow it to a specific role. The shell picks its
// nav from user.role, so pages below render content only.
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, cookieStore] = await Promise.all([requireUser(), cookies()]);
  const collapsed = cookieStore.get(SIDEBAR_COOKIE)?.value === "1";

  return (
    <SidebarShell user={user} defaultCollapsed={collapsed}>
      {children}
    </SidebarShell>
  );
}
