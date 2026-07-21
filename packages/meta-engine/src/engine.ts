import {
  modeContextSchema,
  weaponMetaInputSchema,
  type ModeContext,
  type ScoreLine,
  type TierLetter,
  type TierResult,
  type WeaponMetaInput,
} from "./types";

/**
 * Explainable weapon scoring (spec §10). No hidden numbers: every contribution
 * is returned as a labeled breakdown line, weights live in MODE_CONTEXTS, and
 * the methodology is versioned. Bump METHODOLOGY.version on ANY formula change
 * and store new snapshots rather than overwriting old ones.
 */
export const METHODOLOGY = {
  slug: "editorial-baseline",
  version: "1.0.0",
  name: "Editorial baseline scoring",
  description:
    "Range scores weighted per mode, plus explicit adjustments for availability, " +
    "attachment dependency, ease of use, aim-assist rules, and data confidence. " +
    "Component inputs are editorial estimates until verified measurements exist.",
} as const;

/** Tier thresholds on the 0–100 score. */
export const TIER_THRESHOLDS: ReadonlyArray<{ min: number; tier: TierLetter }> = [
  { min: 85, tier: "S" },
  { min: 75, tier: "A" },
  { min: 62, tier: "B" },
  { min: 50, tier: "C" },
  { min: 38, tier: "D" },
  { min: 0, tier: "F" },
];

export function tierForScore(score: number): TierLetter {
  const entry = TIER_THRESHOLDS.find((t) => score >= t.min);
  return entry?.tier ?? "F";
}

const AVAILABILITY_ADJUSTMENT: Record<WeaponMetaInput["availability"], number> = {
  ground_loot: 0,
  // Spec §5.3: never rank airdrop and ground loot together without an
  // availability-adjusted view — this penalty exists only in that view.
  airdrop: -8,
  map_exclusive: -4,
};

const ATTACHMENT_DEPENDENCY_ADJUSTMENT: Record<WeaponMetaInput["attachmentDependency"], number> = {
  low: 2,
  medium: 0,
  high: -4,
};

const CONFIDENCE_ADJUSTMENT: Record<WeaponMetaInput["confidence"], number> = {
  high: 0,
  medium: 0,
  low: -2,
  disputed: -3,
  unverified: -3,
};

export interface ComputeOptions {
  /** Apply the availability penalty (the "availability-adjusted" ranking view). */
  availabilityAdjusted?: boolean;
}

export function computeTier(
  rawInput: WeaponMetaInput,
  rawContext: ModeContext,
  options: ComputeOptions = {},
): TierResult {
  const input = weaponMetaInputSchema.parse(rawInput);
  const ctx = modeContextSchema.parse(rawContext);
  const availabilityAdjusted = options.availabilityAdjusted ?? true;
  const breakdown: ScoreLine[] = [];

  const { close, mid, long } = ctx.rangeWeights;
  breakdown.push({
    label: `Close-range ${input.components.closeRange} × weight ${close}`,
    points: input.components.closeRange * close,
  });
  breakdown.push({
    label: `Mid-range ${input.components.midRange} × weight ${mid}`,
    points: input.components.midRange * mid,
  });
  breakdown.push({
    label: `Long-range ${input.components.longRange} × weight ${long}`,
    points: input.components.longRange * long,
  });

  const availabilityPoints = availabilityAdjusted
    ? AVAILABILITY_ADJUSTMENT[input.availability]
    : 0;
  if (availabilityPoints !== 0) {
    breakdown.push({
      label: `Availability (${input.availability}) in availability-adjusted view`,
      points: availabilityPoints,
    });
  }

  const dependencyPoints = ATTACHMENT_DEPENDENCY_ADJUSTMENT[input.attachmentDependency];
  if (dependencyPoints !== 0) {
    breakdown.push({
      label: `Attachment dependency (${input.attachmentDependency})`,
      points: dependencyPoints,
    });
  }

  const easePoints = ((input.components.easeOfUse - 50) / 50) * ctx.easeWeight * 10;
  if (easePoints !== 0) {
    breakdown.push({
      label: `Ease of use ${input.components.easeOfUse} × mode ease weight ${ctx.easeWeight}`,
      points: easePoints,
    });
  }

  if (ctx.aimAssist === "disabled") {
    // Manual recoil control matters more when aim assist is off (Ultimate Royale).
    const aimAssistPoints = -((input.components.recoilDifficulty - 50) / 50) * 6;
    if (aimAssistPoints !== 0) {
      breakdown.push({
        label: `Aim assist disabled × recoil difficulty ${input.components.recoilDifficulty}`,
        points: aimAssistPoints,
      });
    }
  }

  const roleFitPoints = input.roleFit[ctx.modeSlug] ?? 0;
  if (roleFitPoints !== 0) {
    breakdown.push({ label: `Role fit for ${ctx.modeSlug}`, points: roleFitPoints });
  }

  const confidencePoints = CONFIDENCE_ADJUSTMENT[input.confidence];
  if (confidencePoints !== 0) {
    breakdown.push({
      label: `Data confidence (${input.confidence})`,
      points: confidencePoints,
    });
  }

  const rawScore = breakdown.reduce((sum, line) => sum + line.points, 0);
  const score = Math.min(100, Math.max(0, Number(rawScore.toFixed(2))));
  const tier = tierForScore(score);

  return {
    slug: input.slug,
    modeSlug: ctx.modeSlug,
    score,
    tier,
    breakdown,
    clamped: rawScore < 0 || rawScore > 100,
    availabilityAdjusted,
    methodology: { slug: METHODOLOGY.slug, version: METHODOLOGY.version },
    effectiveTier: tier,
  };
}

/** Editorial override (spec §10): keeps the computed result, records the change. */
export function applyEditorialOverride(
  result: TierResult,
  override: { tier: TierLetter; reason: string },
): TierResult {
  if (override.reason.trim().length === 0) {
    throw new Error("Editorial overrides require a non-empty reason (spec §10).");
  }
  return { ...result, override, effectiveTier: override.tier };
}
