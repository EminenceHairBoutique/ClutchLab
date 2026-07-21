import { describe, expect, it } from "vitest";

import { MODE_CONTEXTS, contextForMode } from "./contexts";
import {
  METHODOLOGY,
  TIER_THRESHOLDS,
  applyEditorialOverride,
  computeTier,
  tierForScore,
} from "./engine";
import { modeContextSchema, type WeaponMetaInput } from "./types";

const baseWeapon: WeaponMetaInput = {
  slug: "test_ar",
  components: { closeRange: 70, midRange: 80, longRange: 60, easeOfUse: 75, recoilDifficulty: 45 },
  availability: "ground_loot",
  attachmentDependency: "medium",
  confidence: "low",
  roleFit: {},
};

describe("mode contexts", () => {
  it("every context passes schema validation (weights sum to 1)", () => {
    for (const ctx of Object.values(MODE_CONTEXTS)) {
      expect(() => modeContextSchema.parse(ctx)).not.toThrow();
    }
  });

  it("throws for unknown modes instead of silently defaulting", () => {
    expect(() => contextForMode("metro")).toThrow(/No scoring context/);
  });
});

describe("computeTier", () => {
  it("breakdown lines sum to the score (explainability invariant)", () => {
    const result = computeTier(baseWeapon, contextForMode("classic_ranked"));
    const sum = result.breakdown.reduce((acc, line) => acc + line.points, 0);
    expect(result.score).toBeCloseTo(sum, 2);
    expect(result.clamped).toBe(false);
  });

  it("is deterministic", () => {
    const a = computeTier(baseWeapon, contextForMode("classic_ranked"));
    const b = computeTier(baseWeapon, contextForMode("classic_ranked"));
    expect(a).toEqual(b);
  });

  it("stamps the versioned methodology", () => {
    const result = computeTier(baseWeapon, contextForMode("classic_ranked"));
    expect(result.methodology).toEqual({
      slug: METHODOLOGY.slug,
      version: METHODOLOGY.version,
    });
  });

  it("weights ranges by mode: arena favors close-range weapons", () => {
    const brawler: WeaponMetaInput = {
      ...baseWeapon,
      slug: "smg",
      components: { ...baseWeapon.components, closeRange: 90, midRange: 55, longRange: 20 },
    };
    const sniper: WeaponMetaInput = {
      ...baseWeapon,
      slug: "dmr",
      components: { ...baseWeapon.components, closeRange: 30, midRange: 70, longRange: 90 },
    };
    const arenaBrawler = computeTier(brawler, contextForMode("ranked_arena"));
    const arenaSniper = computeTier(sniper, contextForMode("ranked_arena"));
    expect(arenaBrawler.score).toBeGreaterThan(arenaSniper.score);

    const classicBrawler = computeTier(brawler, contextForMode("classic_ranked"));
    const classicSniper = computeTier(sniper, contextForMode("classic_ranked"));
    expect(classicSniper.score).toBeGreaterThan(classicBrawler.score);
  });

  it("penalizes airdrop weapons only in the availability-adjusted view (spec §5.3)", () => {
    const airdrop: WeaponMetaInput = { ...baseWeapon, slug: "awm", availability: "airdrop" };
    const adjusted = computeTier(airdrop, contextForMode("classic_ranked"), {
      availabilityAdjusted: true,
    });
    const raw = computeTier(airdrop, contextForMode("classic_ranked"), {
      availabilityAdjusted: false,
    });
    expect(raw.score - adjusted.score).toBeCloseTo(8, 1);
    expect(adjusted.breakdown.some((l) => l.label.includes("Availability"))).toBe(true);
    expect(raw.breakdown.some((l) => l.label.includes("Availability"))).toBe(false);
  });

  it("penalizes high recoil difficulty when aim assist is disabled", () => {
    const hardRecoil: WeaponMetaInput = {
      ...baseWeapon,
      slug: "m762",
      components: { ...baseWeapon.components, recoilDifficulty: 85 },
    };
    const classic = computeTier(hardRecoil, contextForMode("classic_ranked"));
    const ur = computeTier(hardRecoil, contextForMode("ultimate_royale"));
    const classicBase = computeTier(baseWeapon, contextForMode("classic_ranked"));
    const urBase = computeTier(
      { ...baseWeapon, components: { ...baseWeapon.components, recoilDifficulty: 50 } },
      contextForMode("ultimate_royale"),
    );
    // The UR gap between hard- and neutral-recoil weapons exceeds the classic gap.
    const classicGap = classicBase.score - classic.score;
    const urGap = urBase.score - ur.score;
    expect(urGap).toBeGreaterThan(classicGap);
  });

  it("applies role fit only for the matching mode", () => {
    const withFit: WeaponMetaInput = { ...baseWeapon, roleFit: { classic_ranked: 5 } };
    const classic = computeTier(withFit, contextForMode("classic_ranked"));
    const arena = computeTier(withFit, contextForMode("ranked_arena"));
    expect(classic.breakdown.some((l) => l.label.startsWith("Role fit"))).toBe(true);
    expect(arena.breakdown.some((l) => l.label.startsWith("Role fit"))).toBe(false);
  });

  it("discounts unverified confidence and labels it", () => {
    const verified: WeaponMetaInput = { ...baseWeapon, confidence: "high" };
    const unverified: WeaponMetaInput = { ...baseWeapon, confidence: "unverified" };
    const a = computeTier(verified, contextForMode("classic_ranked"));
    const b = computeTier(unverified, contextForMode("classic_ranked"));
    expect(a.score - b.score).toBeCloseTo(3, 1);
    expect(b.breakdown.some((l) => l.label.includes("confidence"))).toBe(true);
  });

  it("clamps to [0,100] and reports clamping", () => {
    const floor: WeaponMetaInput = {
      ...baseWeapon,
      components: { closeRange: 0, midRange: 0, longRange: 0, easeOfUse: 0, recoilDifficulty: 100 },
      availability: "airdrop",
      attachmentDependency: "high",
      confidence: "unverified",
    };
    const result = computeTier(floor, contextForMode("ultimate_royale"));
    expect(result.score).toBe(0);
    expect(result.clamped).toBe(true);
  });

  it("rejects invalid inputs loudly", () => {
    expect(() =>
      computeTier(
        { ...baseWeapon, components: { ...baseWeapon.components, closeRange: 120 } },
        contextForMode("classic_ranked"),
      ),
    ).toThrow();
  });
});

describe("tierForScore", () => {
  it("maps thresholds exactly", () => {
    expect(tierForScore(85)).toBe("S");
    expect(tierForScore(84.99)).toBe("A");
    expect(tierForScore(75)).toBe("A");
    expect(tierForScore(62)).toBe("B");
    expect(tierForScore(50)).toBe("C");
    expect(tierForScore(38)).toBe("D");
    expect(tierForScore(37.99)).toBe("F");
    expect(tierForScore(0)).toBe("F");
  });

  it("thresholds are strictly descending", () => {
    const mins = TIER_THRESHOLDS.map((t) => t.min);
    expect([...mins].sort((a, b) => b - a)).toEqual(mins);
  });
});

describe("applyEditorialOverride", () => {
  it("records the override and changes only the effective tier", () => {
    const result = computeTier(baseWeapon, contextForMode("classic_ranked"));
    const overridden = applyEditorialOverride(result, {
      tier: "S",
      reason: "Dominant pro-scrim presence not captured by editorial components.",
    });
    expect(overridden.tier).toBe(result.tier);
    expect(overridden.effectiveTier).toBe("S");
    expect(overridden.override?.reason).toMatch(/pro-scrim/);
  });

  it("refuses overrides without a reason (spec §10)", () => {
    const result = computeTier(baseWeapon, contextForMode("classic_ranked"));
    expect(() => applyEditorialOverride(result, { tier: "S", reason: "  " })).toThrow(/reason/);
  });
});
