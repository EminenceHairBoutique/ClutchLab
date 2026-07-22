"use client";

import { cn } from "@clutchlab/ui";
import { Bell } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

/**
 * Nav notifications indicator. Fetches the unread count after hydration so the
 * pages it lives on stay static/cacheable (SEO) — only this badge is dynamic.
 * Renders label text too, so it works in the mobile "More" sheet as a row.
 */
export function NotificationsBell({ withLabel = false }: { withLabel?: boolean }) {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/notifications/unread-count", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : { count: 0 }))
      .then((data: { count?: number }) => {
        if (active) setCount(typeof data.count === "number" ? data.count : 0);
      })
      .catch(() => {
        if (active) setCount(0);
      });
    return () => {
      active = false;
    };
  }, []);

  const unread = count ?? 0;
  const badge =
    unread > 0 ? (
      <span
        aria-hidden
        className="absolute -right-1 -top-1 inline-flex min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold leading-4 text-accent-foreground"
      >
        {unread > 9 ? "9+" : unread}
      </span>
    ) : null;

  const label = unread > 0 ? `Notifications (${unread} unread)` : "Notifications";

  return (
    <Link
      href="/notifications"
      aria-label={label}
      className={cn(
        "relative inline-flex items-center gap-2 rounded-md text-sm text-muted hover:text-foreground",
        withLabel ? "px-3 py-2.5" : "p-1.5",
      )}
    >
      <span className="relative inline-flex">
        <Bell aria-hidden className="size-5" />
        {badge}
      </span>
      {withLabel && <span>Notifications</span>}
    </Link>
  );
}
