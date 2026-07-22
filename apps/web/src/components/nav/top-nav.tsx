"use client";

import { cn } from "@clutchlab/ui";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { NotificationsBell } from "@/components/notifications/notifications-bell";
import { DESTINATIONS } from "@/lib/navigation";

/** Desktop header navigation. Hidden on mobile, where BottomNav takes over. */
export function TopNav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 hidden border-b border-border bg-background/90 backdrop-blur md:block">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-6 px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span aria-hidden className="inline-flex size-6 items-center justify-center rounded bg-accent font-mono text-xs font-bold text-accent-foreground">
            CL
          </span>
          ClutchLab
        </Link>
        <nav aria-label="Primary" className="flex-1">
          <ul className="flex items-center gap-1 overflow-x-auto">
            {DESTINATIONS.map((d) => {
              const active = d.href === "/" ? pathname === "/" : pathname.startsWith(d.href);
              return (
                <li key={d.href}>
                  <Link
                    href={d.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "rounded-md px-2.5 py-1.5 text-sm whitespace-nowrap",
                      active ? "bg-surface-raised text-accent" : "text-muted hover:text-foreground",
                    )}
                  >
                    {d.title}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <NotificationsBell />
      </div>
    </header>
  );
}
