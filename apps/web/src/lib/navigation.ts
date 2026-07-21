/**
 * Primary information architecture (spec §4): the 11 destinations, with the
 * 5-item mobile bottom bar (Home, Meta, Train, Coach, Profile) + "More".
 * `phase` records when the destination gets its real feature set; until then the
 * route renders an honest in-development state — never fake data.
 */

export interface NavDestination {
  title: string;
  href: string;
  description: string;
  /** Implementation phase per spec §20. */
  phase: number;
  /** True once the destination has real functionality. */
  live: boolean;
}

export const DESTINATIONS: readonly NavDestination[] = [
  {
    title: "Home",
    href: "/",
    description: "Version and season intelligence at a glance",
    phase: 1,
    live: true,
  },
  {
    title: "Meta",
    href: "/meta",
    description: "Mode-, map-, and version-specific weapon tiers",
    phase: 2,
    live: false,
  },
  {
    title: "Weapons",
    href: "/weapons",
    description: "Weapon Lab: stats, comparisons, attachments",
    phase: 2,
    live: false,
  },
  {
    title: "Settings",
    href: "/settings",
    description: "Settings explainers and the sensitivity builder",
    phase: 3,
    live: false,
  },
  {
    title: "Controls",
    href: "/controls",
    description: "Control Layout Studio with ergonomic analysis",
    phase: 5,
    live: false,
  },
  {
    title: "Training",
    href: "/training",
    description: "Drill library, daily plans, progress tracking",
    phase: 4,
    live: false,
  },
  {
    title: "Coach",
    href: "/coach",
    description: "Post-match AI analysis of your uploaded clips",
    phase: 7,
    live: false,
  },
  {
    title: "Maps",
    href: "/maps",
    description: "Map strategy, drops, rotations, route builder",
    phase: 2,
    live: false,
  },
  {
    title: "Pros",
    href: "/pros",
    description: "Verified pro settings with change history",
    phase: 3,
    live: false,
  },
  {
    title: "Community",
    href: "/community",
    description: "Moderated posts, Q&A, and squad recruitment",
    phase: 6,
    live: false,
  },
  {
    title: "Profile",
    href: "/profile",
    description: "Your device, mechanics profile, and saved setups",
    phase: 1,
    live: true,
  },
] as const;

/** Mobile bottom bar (spec §4 recommended navigation). */
export const BOTTOM_NAV_HREFS = ["/", "/meta", "/training", "/coach", "/profile"] as const;

export const BOTTOM_NAV_LABELS: Record<(typeof BOTTOM_NAV_HREFS)[number], string> = {
  "/": "Home",
  "/meta": "Meta",
  "/training": "Train",
  "/coach": "Coach",
  "/profile": "Profile",
};

export function destinationFor(href: string): NavDestination | undefined {
  return DESTINATIONS.find((d) => d.href === href);
}
