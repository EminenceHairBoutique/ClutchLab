import { describe, expect, it } from "vitest";

import { computeStreak } from "./training-store";

function daysAgo(n: number, now: Date): string {
  const d = new Date(now);
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

describe("computeStreak (§5.14)", () => {
  const now = new Date("2026-07-22T18:00:00Z");

  it("counts consecutive days ending today", () => {
    const dates = new Set([daysAgo(0, now), daysAgo(1, now), daysAgo(2, now)]);
    expect(computeStreak(dates, now)).toBe(3);
  });

  it("keeps the streak alive when today has no practice yet", () => {
    const dates = new Set([daysAgo(1, now), daysAgo(2, now)]);
    expect(computeStreak(dates, now)).toBe(2);
  });

  it("breaks on a fully missed day", () => {
    const dates = new Set([daysAgo(0, now), daysAgo(2, now), daysAgo(3, now)]);
    expect(computeStreak(dates, now)).toBe(1);
  });

  it("is zero with no recent activity", () => {
    expect(computeStreak(new Set(), now)).toBe(0);
    expect(computeStreak(new Set([daysAgo(5, now)]), now)).toBe(0);
  });
});
