const MS_PER_DAY = 86_400_000;

/** Whole days from `now` until `iso` (negative = past, null = unknown/invalid). */
export function daysUntil(iso: string | null, now: Date = new Date()): number | null {
  if (!iso) return null;
  const target = new Date(iso);
  if (Number.isNaN(target.getTime())) return null;
  return Math.ceil((target.getTime() - now.getTime()) / MS_PER_DAY);
}

export function formatDate(iso: string | null): string {
  if (!iso) return "date unverified";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "date unverified";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}
