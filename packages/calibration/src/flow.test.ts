import { describe, expect, it } from "vitest";

import {
  CALIBRATION_STEPS,
  currentStep,
  flowComplete,
  recommend,
  startFlow,
  submitOutcome,
} from "./flow";
import { allSlots, clampValue, keyOf } from "./model";

describe("calibration step catalog", () => {
  it("has the spec §5.7 fourteen steps in order", () => {
    expect(CALIBRATION_STEPS).toHaveLength(14);
    expect(CALIBRATION_STEPS.map((s) => s.order)).toEqual(
      Array.from({ length: 14 }, (_, i) => i + 1),
    );
    expect(CALIBRATION_STEPS[0]?.slug).toBe("baseline_setup");
    expect(CALIBRATION_STEPS[13]?.slug).toBe("final_validation");
  });

  it("every step adjusts at most one slot (one variable at a time)", () => {
    for (const step of CALIBRATION_STEPS) {
      if (step.adjusts) {
        expect(step.adjusts.family).toBeTruthy();
      }
    }
  });

  it("slugs are unique", () => {
    const slugs = CALIBRATION_STEPS.map((s) => s.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});

describe("recommend", () => {
  const spray = CALIBRATION_STEPS.find((s) => s.slug === "spray_3x");
  const turn = CALIBRATION_STEPS.find((s) => s.slug === "turn_90");
  if (!spray || !turn) throw new Error("missing steps");

  it("keeps on-target results", () => {
    expect(recommend(turn, "on_target").kind).toBe("keep");
    expect(recommend(spray, "stable").kind).toBe("keep");
  });

  it("buckets adjustments at ±5% — no fake precision", () => {
    expect(recommend(turn, "overshoot")).toMatchObject({ kind: "decrease_small", factor: 0.95 });
    expect(recommend(turn, "undershoot")).toMatchObject({ kind: "increase_small", factor: 1.05 });
  });

  it("suggests checking grip before big changes on unstable sprays", () => {
    const rec = recommend(spray, "unstable");
    expect(rec.kind).toBe("decrease_small");
    expect(rec.rationale).toMatch(/grip/i);
  });

  it("rejects outcomes that don't fit the step's metric", () => {
    expect(recommend(spray, "overshoot").kind).toBe("retest");
  });
});

describe("flow state machine", () => {
  const initial = Object.fromEntries(allSlots().map((slot) => [keyOf(slot), 100]));

  it("walks all 14 steps and completes", () => {
    let state = startFlow(initial);
    while (!flowComplete(state)) {
      const step = currentStep(state);
      if (!step) throw new Error("no step");
      state = submitOutcome(state, step.outcomes[0] ?? "on_target");
    }
    expect(flowComplete(state)).toBe(true);
    expect(Object.keys(state.results)).toHaveLength(14);
  });

  it("applies exactly one adjustment per non-neutral outcome", () => {
    let state = startFlow(initial);
    state = submitOutcome(state, "on_target"); // baseline
    const before = { ...state.values };
    state = submitOutcome(state, "overshoot"); // turn_90 → camera:no_scope_tpp −5%
    const changed = Object.keys(state.values).filter((k) => state.values[k] !== before[k]);
    expect(changed).toEqual(["camera:no_scope_tpp"]);
    expect(state.values["camera:no_scope_tpp"]).toBe(95);
    expect(state.adjustments).toHaveLength(1);
    expect(state.adjustments[0]).toMatchObject({ step: "turn_90", from: 100, to: 95 });
  });

  it("never mutates prior state (immutability for undo/history)", () => {
    const state = startFlow(initial);
    const next = submitOutcome(state, "on_target");
    expect(state.stepIndex).toBe(0);
    expect(next.stepIndex).toBe(1);
    expect(state.results).toEqual({});
  });

  it("clamps adjusted values into 1–300", () => {
    expect(clampValue(0.4)).toBe(1);
    expect(clampValue(400)).toBe(300);
    let state = startFlow({ "camera:no_scope_tpp": 1 });
    state = submitOutcome(state, "on_target");
    state = submitOutcome(state, "overshoot");
    expect(state.values["camera:no_scope_tpp"]).toBe(1);
    // No-op adjustments are not logged as changes.
    expect(state.adjustments).toHaveLength(0);
  });

  it("throws when submitting to a finished flow", () => {
    let state = startFlow(initial);
    while (!flowComplete(state)) {
      const step = currentStep(state);
      state = submitOutcome(state, step?.outcomes[0] ?? "on_target");
    }
    expect(() => submitOutcome(state, "on_target")).toThrow(/complete/);
  });
});
