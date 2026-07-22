// @vitest-environment node
import { DRILLS, SKILLS } from "@clutchlab/content";
import { describe, expect, it } from "vitest";

import { generatePlan, type GeneratePlanInput } from "./generate-plan";

const categoryBySkill = new Map(SKILLS.map((s) => [s.slug, s.category]));

const base: GeneratePlanInput = { minutes: 30, focusCategories: [], aimAssist: "mixed" };

describe("generatePlan", () => {
  it("fills the budget without exceeding it", () => {
    for (const minutes of [5, 10, 15, 30, 45, 60] as const) {
      const plan = generatePlan(DRILLS, categoryBySkill, { ...base, minutes });
      expect(plan.totalMinutes).toBeLessThanOrEqual(minutes);
      expect(plan.items.length).toBeGreaterThan(0);
    }
  });

  it("is deterministic for identical inputs", () => {
    const a = generatePlan(DRILLS, categoryBySkill, base);
    const b = generatePlan(DRILLS, categoryBySkill, base);
    expect(a.items.map((i) => i.drill.slug)).toEqual(b.items.map((i) => i.drill.slug));
  });

  it("never repeats a drill in one plan", () => {
    const plan = generatePlan(DRILLS, categoryBySkill, { ...base, minutes: 60 });
    const slugs = plan.items.map((i) => i.drill.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("respects focus categories when they match", () => {
    const plan = generatePlan(DRILLS, categoryBySkill, {
      ...base,
      focusCategories: ["recoil"],
    });
    for (const item of plan.items) {
      expect(categoryBySkill.get(item.drill.skillSlug)).toBe("recoil");
    }
  });

  it("falls back to the full catalog with a note when focus matches nothing", () => {
    const plan = generatePlan(DRILLS, categoryBySkill, {
      ...base,
      focusCategories: ["not_a_category"],
    });
    expect(plan.items.length).toBeGreaterThan(0);
    expect(plan.notes.join(" ")).toMatch(/full catalog/);
  });

  it("excludes aim-assist-on variants when preparing for aim-assist-off play", () => {
    const plan = generatePlan(DRILLS, categoryBySkill, {
      ...base,
      minutes: 60,
      aimAssist: "off",
    });
    for (const item of plan.items) {
      expect(item.drill.aimAssistVariant).not.toBe("on");
    }
    expect(plan.notes.join(" ")).toMatch(/Ultimate Royale/);
  });

  it("spreads across categories rather than stacking one skill", () => {
    const plan = generatePlan(DRILLS, categoryBySkill, { ...base, minutes: 30 });
    const categories = new Set(
      plan.items.map((i) => categoryBySkill.get(i.drill.skillSlug) ?? "other"),
    );
    expect(categories.size).toBeGreaterThanOrEqual(Math.min(3, plan.items.length));
  });

  it("deprioritizes mastered drills for variety", () => {
    const first = generatePlan(DRILLS, categoryBySkill, { ...base, minutes: 15 });
    const masteredSlugs = first.items.map((i) => i.drill.slug);
    const second = generatePlan(DRILLS, categoryBySkill, { ...base, minutes: 15, masteredSlugs });
    expect(second.items.map((i) => i.drill.slug)).not.toEqual(masteredSlugs);
  });
});
