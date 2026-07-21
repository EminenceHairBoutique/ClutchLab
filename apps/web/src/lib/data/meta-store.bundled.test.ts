// @vitest-environment node
import { describe, expect, it } from "vitest";

import { BundledMetaStore } from "./meta-store.bundled";

const store = new BundledMetaStore();

describe("BundledMetaStore", () => {
  it("reports its provenance honestly", () => {
    expect(store.provenance).toBe("bundled-baseline");
  });

  it("serves 4.5 version intel with three seasons and weapon changes", async () => {
    const intel = await store.getVersionIntel();
    expect(intel.version?.version).toBe("4.5");
    expect(intel.version?.dataStatus).toBe("unverified");
    expect(intel.seasons).toHaveLength(3);
    expect(intel.changes.some((c) => c.targetSlug === "ace32")).toBe(true);
  });

  it("serves tier boards for both snapshot modes, sorted best-first", async () => {
    for (const mode of ["classic_ranked", "ultimate_royale"]) {
      const board = await store.getTierBoard(mode);
      expect(board, mode).not.toBeNull();
      expect(board?.entries.length).toBeGreaterThanOrEqual(25);
      const scores = board?.entries.map((e) => e.score ?? 0) ?? [];
      const tierIndex = (t: string) => ["S", "A", "B", "C", "D", "F"].indexOf(t);
      const tiers = board?.entries.map((e) => tierIndex(e.tier)) ?? [];
      expect([...tiers].sort((a, b) => a - b)).toEqual(tiers);
      expect(scores.every((s) => s >= 0 && s <= 100)).toBe(true);
    }
  });

  it("returns null for modes without a snapshot instead of inventing one", async () => {
    expect(await store.getTierBoard("ranked_arena")).toBeNull();
    expect(await store.getTierBoard("nonsense")).toBeNull();
  });

  it("every tier entry ships an explainable breakdown", async () => {
    const board = await store.getTierBoard("classic_ranked");
    for (const entry of board?.entries ?? []) {
      expect(entry.breakdown.length, entry.weaponSlug).toBeGreaterThanOrEqual(3);
      const sum = entry.breakdown.reduce((acc, l) => acc + l.points, 0);
      expect(entry.score, entry.weaponSlug).toBeCloseTo(sum, 1);
    }
  });

  it("lists the full tierable catalog without sample placeholders", async () => {
    const weapons = await store.listWeapons();
    expect(weapons.length).toBeGreaterThanOrEqual(25);
    expect(weapons.every((w) => w.dataStatus === "unverified")).toBe(true);
  });

  it("serves weapon detail with tiers, impacts, and compatible attachments", async () => {
    const m416 = await store.getWeaponDetail("m416");
    expect(m416?.tiers).toHaveLength(2);
    expect(m416?.attachments.some((a) => a.slug === "compensator_ar")).toBe(true);

    const ace = await store.getWeaponDetail("ace32");
    expect(ace?.impacts[0]?.impact).toBe("retest_required");

    const vector = await store.getWeaponDetail("vector");
    expect(vector?.impacts[0]?.impact).toBe("review_recommended");

    expect(await store.getWeaponDetail("nope")).toBeNull();
  });
});
