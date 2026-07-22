import { describe, expect, it } from "vitest";

import { drillsBySkill, planList, snapshotMeta, tierList, versionSummary } from "./selectors";

describe("mobile content selectors", () => {
  it("summarizes version 4.5 with its honesty metadata intact", () => {
    const summary = versionSummary();
    expect(summary.version).toBe("4.5");
    expect(summary.headline.length).toBeGreaterThan(10);
    // Data integrity: the bundled record carries its unverified status forward.
    expect(summary.dataStatus).toBe("unverified");
    expect(summary.sourceName).toBeTruthy();
  });

  it("produces a sorted tier list from the versioned engine", () => {
    const rows = tierList("classic_ranked");
    expect(rows.length).toBeGreaterThan(10);
    for (let i = 1; i < rows.length; i++) {
      const prev = rows[i - 1];
      const current = rows[i];
      expect(prev && current && prev.score >= current.score).toBe(true);
    }
    expect(rows[0]?.tier).toMatch(/^[SABCDF]$/);
    expect(snapshotMeta().methodologyVersion).toBeTruthy();
  });

  it("groups every drill under a known skill", () => {
    const groups = drillsBySkill();
    const totalDrills = groups.reduce((sum, g) => sum + g.drills.length, 0);
    expect(totalDrills).toBeGreaterThanOrEqual(40);
    for (const group of groups) {
      for (const drill of group.drills) {
        expect(drill.skillSlug).toBe(group.skill.slug);
      }
    }
  });

  it("lists training plans with their drill counts", () => {
    const plans = planList();
    expect(plans.length).toBeGreaterThanOrEqual(10);
    for (const plan of plans) {
      expect(plan.drillCount).toBeGreaterThan(0);
    }
  });
});
