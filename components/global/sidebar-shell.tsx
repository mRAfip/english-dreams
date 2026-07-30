"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronsUpDown,
  MoreHorizontal,
  PanelLeft,
  PanelLeftOpen,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { LogoMark } from "@/components/global/logo";
import { Navbar } from "@/components/global/navbar";
import {
  activeNavItem,
  mobileBarNav,
  NAV_BY_ROLE,
  type NavGroup,
} from "@/lib/nav";
import { ROLE_LABEL } from "@/lib/auth/roles";
import type { CurrentUser } from "@/lib/auth/guards";

export const SIDEBAR_COOKIE = "ed_sidebar_collapsed";

/**
 * The authenticated frame. Two shapes from one shell:
 *
 *  - Desktop (md+): a fixed sidebar column on the left, topbar + scrollable
 *    content on the right. The sidebar can collapse to an icon rail.
 *  - Phones (< md): the sidebar is gone. A top bar carries a menu button and
 *    the account avatar; an icons-only tab bar sits at the bottom for the
 *    primary destinations; and everything else lives in an off-canvas drawer
 *    the menu button opens. This is the app-like layout most students use.
 *
 * The collapsed preference rides in a cookie rather than localStorage so the
 * layout can read it on the server and render the correct width immediately —
 * localStorage would only be readable after hydration, flashing the sidebar
 * open before snapping shut.
 */
export function SidebarShell({
  user,
  defaultCollapsed = false,
  children,
}: {
  user: CurrentUser;
  defaultCollapsed?: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const groups = NAV_BY_ROLE[user.role];
  const active = activeNavItem(user.role, pathname);

  // While the drawer is open, freeze the body behind it.
  useEffect(() => {
    if (!drawerOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [drawerOpen]);

  function toggle() {
    setCollapsed((prev) => {
      const next = !prev;
      document.cookie = `${SIDEBAR_COOKIE}=${next ? "1" : "0"};path=/;max-age=31536000;samesite=lax`;
      return next;
    });
  }

  return (
    // Pinned to the viewport (out of flow) so the app never window-scrolls,
    // regardless of how tall the content grows — only the content <main>
    // scrolls. Each column carries min-h-0 so the internal scroll resolves.
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-card">
      {/* Brand hairline across the top of the whole app. */}
      <div className="h-1 shrink-0 bg-primary" />

      <div className="flex min-h-0 flex-1">
        {/* Desktop sidebar — hidden on phones in favour of the tab bar. */}
        <aside
          className={cn(
            "hidden shrink-0 flex-col border-r border-border bg-card transition-[width] duration-200 ease-out md:flex",
            collapsed ? "w-18" : "w-66",
          )}
        >
          <WorkspaceHeader user={user} collapsed={collapsed} />

          <nav className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
            {groups.map((group, i) => (
              <NavGroupBlock
                key={group.title ?? `group-${i}`}
                group={group}
                collapsed={collapsed}
                activeHref={active?.href ?? null}
              />
            ))}
          </nav>

          <button
            type="button"
            onClick={toggle}
            aria-expanded={!collapsed}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={cn(
              "flex h-14 shrink-0 items-center gap-3 border-t border-border px-5 text-sm text-mute transition-colors hover:text-ink",
              collapsed && "justify-center px-0",
            )}
          >
            {collapsed ? (
              <PanelLeftOpen className="size-4.5" />
            ) : (
              <PanelLeft className="size-4.5" />
            )}
            {!collapsed && <span>Collapse</span>}
          </button>
        </aside>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <Navbar
            user={user}
            pageTitle={active?.label ?? null}
            onMenuClick={() => setDrawerOpen(true)}
          />
          {/* White on phones (seamless with the top bar), sage from md up. */}
          <main className="min-h-0 flex-1 overflow-y-auto bg-card md:bg-sage">
            {/* Extra bottom padding on phones clears the floating tab bar. */}
            <div className="mx-auto w-full max-w-300 px-4 pt-5 pb-28 sm:px-6 sm:pt-6 md:px-8 md:pt-8 md:pb-8">
              {children}
            </div>
          </main>
        </div>
      </div>

      {/* Phone tab bar — icons only, primary destinations + More. */}
      <MobileTabBar
        user={user}
        activeHref={active?.href ?? null}
        onMore={() => setDrawerOpen(true)}
      />

      {/* Phone navigation drawer — the full sidebar as an off-canvas sheet. */}
      <MobileDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        user={user}
        groups={groups}
        activeHref={active?.href ?? null}
      />
    </div>
  );
}

function WorkspaceHeader({
  user,
  collapsed,
}: {
  user: CurrentUser;
  collapsed: boolean;
}) {
  return (
    <div className="flex h-16 shrink-0 items-center px-3">
      <div
        className={cn(
          "flex h-11 w-full items-center gap-2.5 rounded-xl px-2",
          collapsed && "justify-center px-0",
        )}
      >
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary-pale">
          <LogoMark className="size-5" />
        </span>
        {!collapsed && (
          <>
            <span className="min-w-0 flex-1 text-left">
              <span className="block truncate font-display text-[15px] font-extrabold tracking-tight text-ink">
                English Dreams
              </span>
              <span className="block truncate text-xs text-mute">
                {ROLE_LABEL[user.role]} workspace
              </span>
            </span>
            <ChevronsUpDown className="size-4 shrink-0 text-mute" />
          </>
        )}
      </div>
    </div>
  );
}

function NavGroupBlock({
  group,
  collapsed,
  activeHref,
  onNavigate,
}: {
  group: NavGroup;
  collapsed: boolean;
  activeHref: string | null;
  onNavigate?: () => void;
}) {
  return (
    <div className={cn(group.title ? "mt-6" : "mt-1")}>
      {group.title &&
        (collapsed ? (
          <div className="mx-auto my-3 h-px w-6 bg-border" />
        ) : (
          <p className="mb-1.5 px-3 text-xs font-semibold text-mute">
            {group.title}
          </p>
        ))}

      <ul className="space-y-0.5">
        {group.items.map((item) => {
          const isActive = item.href === activeHref;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={onNavigate}
                title={collapsed ? item.label : undefined}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex h-9 items-center gap-3 rounded-lg px-3 text-sm transition-colors",
                  collapsed && "justify-center px-0",
                  isActive
                    ? "font-semibold text-brand-green"
                    : "text-body hover:bg-muted hover:text-ink",
                )}
              >
                <item.icon
                  className={cn(
                    "size-4.5 shrink-0",
                    isActive ? "text-brand-green" : "text-mute",
                  )}
                />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * The bottom tab bar — phones only. Icons alone, primary destinations plus a
 * More button that opens the drawer for everything else. A flex sibling of the
 * content row (not fixed-position), so it reserves its own space and never
 * covers the page.
 */
function MobileTabBar({
  user,
  activeHref,
  onMore,
}: {
  user: CurrentUser;
  activeHref: string | null;
  onMore: () => void;
}) {
  const items = mobileBarNav(user.role);

  return (
    // Floating pill, detached from the edges — overlays the content, which is
    // given bottom padding so nothing hides behind it.
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-30 px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] md:hidden"
    >
      <div className="mx-auto flex w-full max-w-md items-center rounded-full bg-ink px-2 py-2 shadow-lg">
        {items.map((item) => (
          <TabBarItem
            key={item.href}
            href={item.href}
            label={item.label}
            icon={item.icon}
            active={item.href === activeHref}
          />
        ))}
        <button
          type="button"
          onClick={onMore}
          aria-label="More"
          className="flex flex-1 flex-col items-center gap-1"
        >
          <span className="grid size-10 place-items-center rounded-full">
            <MoreHorizontal className="size-5 text-primary-foreground/80" />
          </span>
          <span className="text-[10px] font-medium leading-none text-primary-foreground/70">
            More
          </span>
        </button>
      </div>
    </nav>
  );
}

function TabBarItem({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      className="flex min-w-0 flex-1 flex-col items-center gap-1"
    >
      <span
        className={cn(
          "grid size-10 shrink-0 place-items-center rounded-full transition-colors",
          active ? "bg-primary" : "",
        )}
      >
        <Icon
          className={cn(
            "size-5",
            active ? "text-primary-foreground" : "text-primary-foreground/80",
          )}
        />
      </span>
      <span
        className={cn(
          "max-w-full truncate text-[10px] leading-none",
          active
            ? "font-semibold text-primary-foreground"
            : "font-medium text-primary-foreground/70",
        )}
      >
        {label}
      </span>
    </Link>
  );
}

/**
 * Full navigation as an off-canvas sheet — phones only. Reuses the sidebar's
 * group blocks so the drawer and the desktop rail never drift apart.
 */
function MobileDrawer({
  open,
  onClose,
  user,
  groups,
  activeHref,
}: {
  open: boolean;
  onClose: () => void;
  user: CurrentUser;
  groups: NavGroup[];
  activeHref: string | null;
}) {
  return (
    <div
      className={cn(
        "fixed inset-0 z-50 md:hidden",
        open ? "pointer-events-auto" : "pointer-events-none",
      )}
      aria-hidden={!open}
    >
      {/* Scrim */}
      <button
        type="button"
        tabIndex={open ? 0 : -1}
        aria-label="Close menu"
        onClick={onClose}
        className={cn(
          "absolute inset-0 bg-ink/40 transition-opacity duration-200",
          open ? "opacity-100" : "opacity-0",
        )}
      />

      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Navigation"
        className={cn(
          "absolute inset-y-0 left-0 flex w-72 max-w-[85%] flex-col border-r border-border bg-card shadow-xl transition-transform duration-200 ease-out",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-16 shrink-0 items-center justify-between px-4">
          <div className="flex items-center gap-2.5">
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary-pale">
              <LogoMark className="size-5" />
            </span>
            <span className="min-w-0">
              <span className="block truncate font-display text-[15px] font-extrabold tracking-tight text-ink">
                English Dreams
              </span>
              <span className="block truncate text-xs text-mute">
                {ROLE_LABEL[user.role]} workspace
              </span>
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="grid size-9 place-items-center rounded-lg text-mute transition-colors hover:bg-muted hover:text-ink"
          >
            <X className="size-5" />
          </button>
        </div>

        <nav className="min-h-0 flex-1 overflow-y-auto px-3 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
          {groups.map((group, i) => (
            <NavGroupBlock
              key={group.title ?? `group-${i}`}
              group={group}
              collapsed={false}
              activeHref={activeHref}
              onNavigate={onClose}
            />
          ))}
        </nav>
      </div>
    </div>
  );
}
