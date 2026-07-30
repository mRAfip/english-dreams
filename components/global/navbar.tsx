"use client";

import Link from "next/link";
import { ChevronRight, LifeBuoy, Menu, Search } from "lucide-react";
import { UserMenu } from "@/components/global/user-menu";
import { NotificationBell } from "@/components/global/notification-bell";
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
    <header className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-transparent bg-card px-4 md:border-border sm:px-6">
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
          <Link
            href={home}
            className="hidden shrink-0 text-sm text-mute transition-colors hover:text-ink sm:block"
          >
            {ROLE_LABEL[user.role]}
          </Link>
          {pageTitle && (
            <>
              <ChevronRight className="hidden size-3.5 shrink-0 text-mute sm:block" />
              <span className="truncate text-sm font-semibold text-ink">
                {pageTitle}
              </span>
            </>
          )}
        </nav>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <SearchTrigger />
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
function SearchTrigger() {
  return (
    <button
      type="button"
      disabled
      title="Search — coming soon"
      className="hidden h-9 w-56 cursor-not-allowed items-center gap-2 rounded-lg border border-border px-3 text-sm text-mute md:flex"
    >
      <Search className="size-4 shrink-0" />
      <span className="flex-1 text-left">Search</span>
      <kbd className="rounded border border-border px-1.5 py-0.5 font-sans text-[10px] text-mute">
        ⌘K
      </kbd>
    </button>
  );
}
