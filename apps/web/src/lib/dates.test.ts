// @vitest-environment node
import { describe, expect, it } from "vitest";

import { daysUntil, formatDate } from "./dates";

describe("daysUntil", () => {
  const now = new Date("2026-07-21T12:00:00Z");

  it("counts whole days remaining", () => {
    expect(daysUntil("2026-09-11T23:59:59Z", now)).toBe(53);
    expect(daysUntil("2026-07-22T12:00:00Z", now)).toBe(1);
  });

  it("returns negatives for the past and null for unknown", () => {
    expect(daysUntil("2026-07-01T00:00:00Z", now)).toBeLessThan(0);
    expect(daysUntil(null, now)).toBeNull();
    expect(daysUntil("not-a-date", now)).toBeNull();
  });
});

describe("formatDate", () => {
  it("formats ISO dates in UTC and is honest about unknowns", () => {
    expect(formatDate("2026-07-09")).toBe("Jul 9, 2026");
    expect(formatDate(null)).toBe("date unverified");
    expect(formatDate("garbage")).toBe("date unverified");
  });
});
