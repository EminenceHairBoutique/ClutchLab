import { describe, expect, it } from "vitest";

import {
  PLAN_TIERS,
  canAnalyzeKind,
  entitlementsFor,
  isPlanTier,
  withinLimit,
} from "./entitlements";

describe("entitlements (§14)", () => {
  it("free plan has no AI reviews, one profile, one layout", () => {
    const free = entitlementsFor("free");
    expect(free.coachAnalysesPerMonth).toBe(0);
    expect(free.coachUploadKinds).toHaveLength(0);
    expect(free.sensitivityProfiles).toBe(1);
    expect(free.controlLayouts).toBe(1);
    expect(free.fullProVault).toBe(false);
  });

  it("pro plan gets limited clip reviews but not full-match", () => {
    const pro = entitlementsFor("pro");
    expect(pro.coachAnalysesPerMonth).toBe(10);
    expect(canAnalyzeKind("pro", "clip")).toBe(true);
    expect(canAnalyzeKind("pro", "screenshot")).toBe(true);
    expect(canAnalyzeKind("pro", "full_match")).toBe(false);
    expect(pro.sensitivityProfiles).toBe("unlimited");
    expect(pro.fullProVault).toBe(true);
  });

  it("elite plan gets more analyses including full-match reviews", () => {
    const elite = entitlementsFor("elite");
    expect(elite.coachAnalysesPerMonth).toBeGreaterThan(entitlementsFor("pro").coachAnalysesPerMonth);
    expect(canAnalyzeKind("elite", "full_match")).toBe(true);
    expect(elite.coachDiscount).toBe(true);
  });

  it("withinLimit treats limits as allowances for the NEXT item", () => {
    expect(withinLimit(1, 0)).toBe(true);
    expect(withinLimit(1, 1)).toBe(false);
    expect(withinLimit("unlimited", 10_000)).toBe(true);
  });

  it("isPlanTier narrows only real tiers", () => {
    for (const plan of PLAN_TIERS) expect(isPlanTier(plan)).toBe(true);
    expect(isPlanTier("mega")).toBe(false);
  });
});
