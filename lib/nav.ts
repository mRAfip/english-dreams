import {
  Award,
  ClipboardCheck,
  GraduationCap,
  Home,
  Inbox,
  LibraryBig,
  ListChecks,
  Route,
  Trophy,
  UserCog,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "@/types/role";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
};

/** A titled block of nav items. `title: null` renders as an unlabelled top group. */
export type NavGroup = {
  title: string | null;
  items: NavItem[];
};

/** Shared by every role — appended to each role's own groups. */
const ACCOUNT_GROUP: NavGroup = {
  title: "Account",
  items: [
    { label: "Inbox", href: "/inbox", icon: Inbox },
    { label: "Profile", href: "/profile", icon: UserCog },
  ],
};

export const NAV_BY_ROLE: Record<Role, NavGroup[]> = {
  admin: [
    {
      title: null,
      items: [
        { label: "Home", href: "/admin", icon: Home },
      ],
    },
    {
      title: "Manage",
      items: [
        { label: "Students", href: "/admin/students", icon: Users },
        { label: "Trainers", href: "/admin/trainers", icon: GraduationCap },
        {
          label: "Content",
          href: "/admin/content-management",
          icon: LibraryBig,
        },
      ],
    },
    {
      title: "Recognition",
      items: [
        { label: "Leaderboard", href: "/admin/leaderboard", icon: Trophy },
        { label: "Certificates", href: "/admin/certificates", icon: Award },
      ],
    },
    ACCOUNT_GROUP,
  ],
  trainer: [
    {
      title: null,
      items: [{ label: "Home", href: "/trainer", icon: Home }],
    },
    {
      title: "Teaching",
      items: [
        {
          label: "Assigned students",
          href: "/trainer/assigned-students",
          icon: Users,
        },
        {
          label: "Review tasks",
          href: "/trainer/review-tasks",
          icon: ClipboardCheck,
        },
      ],
    },
    {
      title: "Community",
      items: [
        { label: "Leaderboard", href: "/trainer/leaderboard", icon: Trophy },
      ],
    },
    ACCOUNT_GROUP,
  ],
  student: [
    {
      title: null,
      items: [{ label: "Home", href: "/student", icon: Home }],
    },
    {
      title: "Learn",
      items: [
        {
          label: "Learning path",
          href: "/student/learning-path",
          icon: Route,
        },
        { label: "Quizzes", href: "/student/quizzes", icon: ListChecks },
        {
          label: "Certificates",
          href: "/student/certificates",
          icon: Award,
        },
      ],
    },
    // No leaderboard for students — ranking classmates against each other
    // works against a beginner's confidence, which is the thing the programme
    // is actually trying to build. Staff keep their boards.
    ACCOUNT_GROUP,
  ],
};

/** Every nav item for a role, flattened — used for active state + breadcrumbs. */
export function flatNav(role: Role): NavItem[] {
  return NAV_BY_ROLE[role].flatMap((group) => group.items);
}

/** Hrefs that live in the shared Account group — kept out of the mobile tab bar. */
const ACCOUNT_HREFS = new Set(ACCOUNT_GROUP.items.map((i) => i.href));

/**
 * The icons-only tab bar shown at the bottom of the screen on phones. Room for
 * a handful of destinations only, so we take a role's primary work items (Home
 * plus its main group) and cap at four — the fifth slot is always "More", which
 * opens the full navigation drawer. Nothing is lost: everything the sidebar
 * shows is reachable from the drawer.
 */
export function mobileBarNav(role: Role): NavItem[] {
  return flatNav(role)
    .filter((item) => !ACCOUNT_HREFS.has(item.href))
    .slice(0, 4);
}

/**
 * The item matching `pathname`. Longest href wins so /admin/students beats the
 * /admin home entry.
 */
export function activeNavItem(role: Role, pathname: string): NavItem | null {
  return (
    flatNav(role)
      .filter(
        (item) =>
          pathname === item.href || pathname.startsWith(`${item.href}/`),
      )
      .sort((a, b) => b.href.length - a.href.length)[0] ?? null
  );
}
