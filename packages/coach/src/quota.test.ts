import { describe, expect, it } from "vitest";

import { currentQuotaWindowStart, quotaState } from "./quota";

describe("quota", () => {
  it("computes remaining allowance and clamps at zero", () => {
    expect(quotaState(0)).toEqual({ used: 0, limit: 10, remaining: 10 });
    expect(quotaState(7)).toEqual({ used: 7, limit: 10, remaining: 3 });
    expect(quotaState(25)).toEqual({ used: 25, limit: 10, remaining: 0 });
    expect(quotaState(-3)).toEqual({ used: 0, limit: 10, remaining: 10 });
  });

  it("windows reset on the first of the UTC month", () => {
    const start = currentQuotaWindowStart(new Date("2026-07-21T22:15:00Z"));
    expect(start.toISOString()).toBe("2026-07-01T00:00:00.000Z");
  });
});
