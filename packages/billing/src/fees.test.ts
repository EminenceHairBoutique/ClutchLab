import { describe, expect, it } from "vitest";

import { computeFeeSplit } from "./fees";

describe("computeFeeSplit", () => {
  it("splits with the fee floored so fee + net always equals amount", () => {
    const split = computeFeeSplit(1500);
    expect(split.platformFeeCents).toBe(300);
    expect(split.coachNetCents).toBe(1200);
    expect(split.platformFeeCents + split.coachNetCents).toBe(split.amountCents);

    const odd = computeFeeSplit(999);
    expect(odd.platformFeeCents + odd.coachNetCents).toBe(999);
  });

  it("rejects non-positive or fractional amounts", () => {
    expect(() => computeFeeSplit(0)).toThrow(/invalid/);
    expect(() => computeFeeSplit(-100)).toThrow(/invalid/);
    expect(() => computeFeeSplit(10.5)).toThrow(/invalid/);
  });
});
