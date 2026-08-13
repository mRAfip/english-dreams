"use client";

import Link from "next/link";
import { ChevronRight, LifeBuoy, Menu, Search } from "lucide-react";
import { UserMenu } from "@/components/global/user-menu";
import { NotificationBell } from "@/components/global/notification-bell";
import { Logo } from "@/components/global/logo";
import { ROLE_HOME, ROLE_LABEL } from "@/lib/auth/roles";
import type { CurrentUser } from "@/lib/auth/guards";

/**
 * Topbar: breadcrumb on the left, utilities on the right.
 * `pageTitle` comes from the matched nav item so the trail stays in step with
 * the sidebar rather than being re-derived from the URL.
 *
 * On phones the sidebar is gone, so the left slot gains a menu button that
 * opens the navigation drawer and the breadcrumb collapses to just the page
 * title.
 */
export function Navbar({
  user,
  pageTitle,
  onMenuClick,
}: {
  user: CurrentUser;
  pageTitle: string | null;
  onMenuClick?: () => void;
}) {
  const home = ROLE_HOME[user.role];

  return (
    <header className="z-20 flex h-16 shrink-0 items-center justify-between gap-3 border-b border-transparent bg-transparent px-4 md:bg-card md:border-border sm:px-6">
      <div className="flex min-w-0 items-center gap-2">
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Open menu"
          className="-ml-1 grid size-9 shrink-0 place-items-center rounded-lg text-mute transition-colors hover:bg-muted hover:text-ink md:hidden"
        >
          <Menu className="size-5" />
        </button>

        <nav
          aria-label="Breadcrumb"
          className="flex min-w-0 items-center gap-1.5"
        >
          {/* Logo on mobile view (hidden on sm+) */}
          <div className="block sm:hidden">
            <Logo className="h-12 w-28" />
          </div>

          {/* Breadcrumb path on sm+ views (hidden on mobile) */}
          <div className="hidden sm:flex items-center gap-1.5 min-w-0">
            <Link
              href={home}
              className="shrink-0 text-sm text-mute transition-colors hover:text-ink"
            >
              {ROLE_LABEL[user.role]}
            </Link>
            {pageTitle && (
              <>
                <ChevronRight className="size-3.5 shrink-0 text-mute" />
                <span className="truncate text-sm font-semibold text-ink">
                  {pageTitle}
                </span>
              </>
            )}
          </div>
        </nav>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <NotificationBell user={user} />
        <UserMenu user={user} />
      </div>
    </header>
  );
}

/**
 * Visual affordance only for now — the command palette it should open isn't
 * built yet, so it's disabled rather than a button that silently does nothing.
 */

