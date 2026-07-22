// @vitest-environment node
import { LAYOUT_TEMPLATES } from "@clutchlab/content";
import { describe, expect, it } from "vitest";

import { analyzeLayout, assignZone, heightDistance, type PlacedElement } from "./ergonomics";

const el = (slug: string, x: number, y: number, size = 0.08): PlacedElement => ({ slug, x, y, size });

describe("assignZone", () => {
  it("maps corners to the expected fingers", () => {
    expect(assignZone(el("movement_stick", 0.13, 0.7))).toBe("left_thumb");
    expect(assignZone(el("fire_right", 0.86, 0.62))).toBe("right_thumb");
    expect(assignZone(el("fire_left", 0.1, 0.1))).toBe("left_index");
    expect(assignZone(el("scope", 0.9, 0.1))).toBe("right_index");
    expect(assignZone(el("free_look", 0.5, 0.3))).toBe("other");
  });
});

describe("analyzeLayout", () => {
  it("detects overlapping elements as collisions", () => {
    const result = analyzeLayout([el("fire_right", 0.8, 0.6, 0.12), el("scope", 0.82, 0.62, 0.1)]);
    expect(result.collisions).toHaveLength(1);
    expect(result.findings.some((f) => f.severity === "risk" && /overlap/.test(f.text))).toBe(true);
  });

  it("clears well-separated elements", () => {
    const result = analyzeLayout([el("fire_right", 0.85, 0.6), el("scope", 0.9, 0.12)]);
    expect(result.collisions).toHaveLength(0);
  });

  it("flags right-thumb congestion with the spec's canonical advice", () => {
    const crowded = analyzeLayout([
      el("fire_right", 0.8, 0.55), el("scope", 0.9, 0.5), el("crouch", 0.7, 0.75),
      el("jump", 0.78, 0.85), el("reload", 0.62, 0.6),
    ]);
    expect(crowded.findings.some((f) => /index finger/.test(f.text))).toBe(true);
  });

  it("flags edge placements", () => {
    const result = analyzeLayout([el("heal", 0.999, 0.5)]);
    expect(result.findings.some((f) => /screen edge/.test(f.text))).toBe(true);
  });

  it("scores collisions lower than clean layouts", () => {
    const clean = analyzeLayout([el("fire_right", 0.85, 0.6), el("scope", 0.9, 0.12)]);
    const dirty = analyzeLayout([el("fire_right", 0.85, 0.6, 0.12), el("scope", 0.86, 0.62, 0.12)]);
    expect(dirty.score).toBeLessThan(clean.score);
  });

  it("is deterministic and versioned", () => {
    const input = [el("fire_right", 0.85, 0.6)];
    expect(analyzeLayout(input)).toEqual(analyzeLayout(input));
    expect(analyzeLayout(input).engineVersion).toBe("ergonomics-v1");
  });

  it("every shipped template analyzes collision-free with a healthy score", () => {
    for (const template of LAYOUT_TEMPLATES) {
      const analysis = analyzeLayout(template.positions.map((t) => ({ ...t })));
      expect(analysis.collisions, template.slug).toHaveLength(0);
      expect(analysis.score, `${template.slug} score`).toBeGreaterThanOrEqual(70);
    }
  });
});

describe("heightDistance", () => {
  it("corrects horizontal distance for the 16:9 aspect", () => {
    const horizontal = heightDistance(el("a", 0, 0.5), el("b", 0.5, 0.5));
    const vertical = heightDistance(el("a", 0.5, 0), el("b", 0.5, 0.5));
    expect(horizontal).toBeCloseTo((16 / 9) * 0.5, 5);
    expect(vertical).toBeCloseTo(0.5, 5);
  });
});
