"use client";

import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
  cn,
  Badge,
} from "@clutchlab/ui";
import {
  CircleUserRound,
  Clapperboard,
  Home,
  Menu,
  Target,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";

import { NotificationsBell } from "@/components/notifications/notifications-bell";
import { BOTTOM_NAV_HREFS, BOTTOM_NAV_LABELS, DESTINATIONS } from "@/lib/navigation";

const ICONS: Record<(typeof BOTTOM_NAV_HREFS)[number], LucideIcon> = {
  "/": Home,
  "/meta": TrendingUp,
  "/training": Target,
  "/coach": Clapperboard,
  "/profile": CircleUserRound,
};

function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

/** 5-item thumb-reach bottom bar + "More" sheet exposing all 11 destinations (spec §4). */
export function BottomNav() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = React.useState(false);

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/90 backdrop-blur md:hidden"
    >
      <ul className="grid grid-cols-6 items-stretch pb-[env(safe-area-inset-bottom)]">
        {BOTTOM_NAV_HREFS.map((href) => {
          const Icon = ICONS[href];
          const active = isActive(pathname, href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium",
                  active ? "text-accent" : "text-muted hover:text-foreground",
                )}
              >
                <Icon aria-hidden className="size-5" />
                {BOTTOM_NAV_LABELS[href]}
              </Link>
            </li>
          );
        })}
        <li>
          <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
            <SheetTrigger
              className="flex h-14 w-full flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-muted hover:text-foreground"
              aria-label="More destinations"
            >
              <Menu aria-hidden className="size-5" />
              More
            </SheetTrigger>
            <SheetContent side="bottom" aria-describedby="more-nav-description">
              <SheetTitle>All destinations</SheetTitle>
              <SheetDescription id="more-nav-description">
                Everything ClutchLab covers. Sections in development are marked with their phase.
              </SheetDescription>
              <div className="mt-3 border-b border-border pb-2">
                <SheetClose asChild>
                  <NotificationsBell withLabel />
                </SheetClose>
              </div>
              <ul className="mt-3 grid grid-cols-1 gap-1">
                {DESTINATIONS.map((d) => (
                  <li key={d.href}>
                    <SheetClose asChild>
                      <Link
                        href={d.href}
                        className={cn(
                          "flex items-center justify-between rounded-md px-3 py-2.5 text-sm",
                          isActive(pathname, d.href)
                            ? "bg-surface-raised text-accent"
                            : "text-foreground hover:bg-surface-raised",
                        )}
                      >
                        <span>
                          {d.title}
                          <span className="block text-xs text-muted">{d.description}</span>
                        </span>
                        {!d.live && <Badge variant="outline">Phase {d.phase}</Badge>}
                      </Link>
                    </SheetClose>
                  </li>
                ))}
              </ul>
            </SheetContent>
          </Sheet>
        </li>
      </ul>
    </nav>
  );
}
