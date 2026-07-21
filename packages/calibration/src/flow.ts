import { clampValue, keyOf, type SensitivityKey, type SensitivityValues } from "./model";

/**
 * Guided calibration flow (spec §5.7): the 14-step sequence, each step testing
 * ONE metric and adjusting at most ONE (family, scope) slot. Recommendations
 * are honest buckets (±5% / ±10%), never fake precision, and several outcomes
 * deliberately recommend retesting instead of changing anything.
 */

export const OUTCOMES = ["overshoot", "undershoot", "on_target", "unstable", "stable"] as const;
export type CalibrationOutcome = (typeof OUTCOMES)[number];

export type RecommendationKind =
  | "keep"
  | "increase_small"
  | "increase_medium"
  | "decrease_small"
  | "decrease_medium"
  | "retest";

export interface CalibrationStep {
  slug: string;
  order: number;
  name: string;
  instructions: string;
  metric: string;
  /** The single slot this step may adjust; null = observational step. */
  adjusts: SensitivityKey | null;
  /** Which outcomes make sense for this step's metric. */
  outcomes: readonly CalibrationOutcome[];
}

const TURN_OUTCOMES = ["overshoot", "undershoot", "on_target"] as const;
const STABILITY_OUTCOMES = ["unstable", "stable"] as const;

export const CALIBRATION_STEPS: readonly CalibrationStep[] = [
  {
    slug: "baseline_setup",
    order: 1,
    name: "Baseline setup",
    instructions:
      "Enter your CURRENT in-game values first. Calibration adjusts your own numbers — it never invents a starting code.",
    metric: "setup",
    adjusts: null,
    outcomes: ["on_target"],
  },
  {
    slug: "turn_90",
    order: 2,
    name: "90° turn test",
    instructions:
      "In Training Grounds, pick a target 90° to your right. Swipe once with your normal thumb stroke. Where did your crosshair land?",
    metric: "turn accuracy",
    adjusts: { family: "camera", scope: "no_scope_tpp" },
    outcomes: TURN_OUTCOMES,
  },
  {
    slug: "turn_180",
    order: 3,
    name: "180° turn test",
    instructions: "Same drill, but turn to a target directly behind you with one swipe.",
    metric: "turn accuracy",
    adjusts: { family: "camera", scope: "no_scope_fpp" },
    outcomes: TURN_OUTCOMES,
  },
  {
    slug: "red_dot_tracking",
    order: 4,
    name: "Red-dot tracking test",
    instructions:
      "ADS with a red dot on a strafing target at ~15m. Track its head for 10 seconds. Does your crosshair drift ahead or behind?",
    metric: "tracking",
    adjusts: { family: "ads", scope: "red_dot" },
    outcomes: TURN_OUTCOMES,
  },
  {
    slug: "hipfire_strafe",
    order: 5,
    name: "Hip-fire strafe test",
    instructions:
      "Strafe left-right while hip-firing a stable AR at a 10m target. Watch the group center relative to the target.",
    metric: "hip-fire centering",
    adjusts: { family: "camera", scope: "red_dot" },
    outcomes: TURN_OUTCOMES,
  },
  {
    slug: "tracking_2x",
    order: 6,
    name: "2× tracking test",
    instructions: "Repeat the tracking drill with a 2× at ~30m.",
    metric: "tracking",
    adjusts: { family: "ads", scope: "x2" },
    outcomes: TURN_OUTCOMES,
  },
  {
    slug: "spray_3x",
    order: 7,
    name: "3× spray test",
    instructions:
      "Spray a full magazine at the 25m wall target with a 3×. Judge the horizontal spread of bullets 10–25.",
    metric: "spray group",
    adjusts: { family: "ads", scope: "x3" },
    outcomes: STABILITY_OUTCOMES,
  },
  {
    slug: "spray_4x",
    order: 8,
    name: "4× spray test",
    instructions: "Same spray drill with a 4× at ~35m.",
    metric: "spray group",
    adjusts: { family: "ads", scope: "x4" },
    outcomes: STABILITY_OUTCOMES,
  },
  {
    slug: "spray_6x_reduced",
    order: 9,
    name: "6× (zoomed to 3×) spray test",
    instructions: "Zoom a 6× down to 3× and repeat the spray drill.",
    metric: "spray group",
    adjusts: { family: "ads", scope: "x6" },
    outcomes: STABILITY_OUTCOMES,
  },
  {
    slug: "dmr_tap",
    order: 10,
    name: "DMR tap test",
    instructions:
      "Tap-fire a DMR with a 6× at 100m: 10 shots at your own cadence. Judge how far the reticle settles between shots.",
    metric: "reset control",
    adjusts: { family: "ads", scope: "x6" },
    outcomes: TURN_OUTCOMES,
  },
  {
    slug: "sniper_micro",
    order: 11,
    name: "Sniper micro-adjustment test",
    instructions:
      "With an 8×, move your crosshair between two head-size targets 5m apart at 200m. Can you stop precisely on each?",
    metric: "micro-adjustment",
    adjusts: { family: "ads", scope: "x8" },
    outcomes: TURN_OUTCOMES,
  },
  {
    slug: "gyro_drift",
    order: 12,
    name: "Gyroscope drift check",
    instructions:
      "Hold your aim on a 100m target for 10 seconds using gyro only, device in your normal grip. Does the reticle hold?",
    metric: "gyro stability",
    adjusts: { family: "gyro", scope: "x3" },
    outcomes: STABILITY_OUTCOMES,
  },
  {
    slug: "close_target_switch",
    order: 13,
    name: "Close-range target-switch test",
    instructions:
      "Hip-fire/red-dot between three targets in a 90° arc at 10m. Judge whether you land on each target or swing past.",
    metric: "target switching",
    adjusts: { family: "camera", scope: "red_dot" },
    outcomes: TURN_OUTCOMES,
  },
  {
    slug: "final_validation",
    order: 14,
    name: "Final validation",
    instructions:
      "Play one full Training Grounds circuit with the new values. If anything feels off, rerun only the affected step.",
    metric: "overall comfort",
    adjusts: null,
    outcomes: ["stable", "unstable"],
  },
] as const;

export function stepBySlug(slug: string): CalibrationStep | undefined {
  return CALIBRATION_STEPS.find((s) => s.slug === slug);
}

export interface Recommendation {
  kind: RecommendationKind;
  /** Multiplier applied to the current value (1 = unchanged). */
  factor: number;
  rationale: string;
}

/**
 * Outcome → bucketed recommendation. Overshoot = too fast (reduce), undershoot
 * = too slow (increase). Instability on spray metrics recommends a SMALL
 * reduction plus explicit advice to check grip before chasing numbers.
 */
export function recommend(step: CalibrationStep, outcome: CalibrationOutcome): Recommendation {
  if (!step.outcomes.includes(outcome)) {
    return {
      kind: "retest",
      factor: 1,
      rationale: `"${outcome}" is not a valid result for the ${step.name}; rerun the step.`,
    };
  }
  if (step.adjusts === null) {
    return { kind: "keep", factor: 1, rationale: "Observational step — nothing to adjust." };
  }
  switch (outcome) {
    case "on_target":
    case "stable":
      return { kind: "keep", factor: 1, rationale: `${step.name}: result is on target — keep this value.` };
    case "overshoot":
      return {
        kind: "decrease_small",
        factor: 0.95,
        rationale: `${step.name}: overshooting suggests this sensitivity is slightly high. Try −5% and retest before any bigger change.`,
      };
    case "undershoot":
      return {
        kind: "increase_small",
        factor: 1.05,
        rationale: `${step.name}: undershooting suggests this sensitivity is slightly low. Try +5% and retest.`,
      };
    case "unstable":
      return {
        kind: "decrease_small",
        factor: 0.95,
        rationale: `${step.name}: spread grows late in the spray. Before changing more than −5%, test a different grip — horizontal spread is often mechanics, not settings.`,
      };
  }
}

export interface FlowState {
  stepIndex: number;
  /** Working copy of the user's values; committed as ONE new version at the end. */
  values: SensitivityValues;
  /** slug → outcome for completed steps. */
  results: Record<string, CalibrationOutcome>;
  /** Applied adjustments log for the final version note. */
  adjustments: Array<{ step: string; key: string; from: number; to: number }>;
}

export function startFlow(initialValues: SensitivityValues): FlowState {
  return { stepIndex: 0, values: { ...initialValues }, results: {}, adjustments: [] };
}

export function currentStep(state: FlowState): CalibrationStep | null {
  return CALIBRATION_STEPS[state.stepIndex] ?? null;
}

/**
 * Record the outcome for the CURRENT step, apply at most its one adjustment
 * (spec: only change one variable at a time), and advance.
 */
export function submitOutcome(state: FlowState, outcome: CalibrationOutcome): FlowState {
  const step = currentStep(state);
  if (!step) throw new Error("Calibration flow already complete.");
  const rec = recommend(step, outcome);
  if (rec.kind === "retest") {
    throw new Error(rec.rationale);
  }

  const next: FlowState = {
    stepIndex: state.stepIndex + 1,
    values: { ...state.values },
    results: { ...state.results, [step.slug]: outcome },
    adjustments: [...state.adjustments],
  };

  if (step.adjusts && rec.factor !== 1) {
    const key = keyOf(step.adjusts);
    const from = state.values[key];
    if (from !== undefined) {
      const to = clampValue(from * rec.factor);
      if (to !== from) {
        next.values[key] = to;
        next.adjustments.push({ step: step.slug, key, from, to });
      }
    }
  }
  return next;
}

export function flowComplete(state: FlowState): boolean {
  return state.stepIndex >= CALIBRATION_STEPS.length;
}
