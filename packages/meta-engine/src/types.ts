import { z } from "zod";

export const TIER_LETTERS = ["S", "A", "B", "C", "D", "F"] as const;
export type TierLetter = (typeof TIER_LETTERS)[number];

export const score100 = z.number().min(0).max(100);

/** Editorial or measured component inputs for one weapon (0–100 scales). */
export const weaponComponentsSchema = z.object({
  closeRange: score100,
  midRange: score100,
  longRange: score100,
  /** Higher = easier to use effectively. */
  easeOfUse: score100,
  /** Higher = harder recoil to control manually. */
  recoilDifficulty: score100,
});
export type WeaponComponents = z.infer<typeof weaponComponentsSchema>;

export const availabilityKindSchema = z.enum(["ground_loot", "airdrop", "map_exclusive"]);
export type AvailabilityKind = z.infer<typeof availabilityKindSchema>;

export const attachmentDependencySchema = z.enum(["low", "medium", "high"]);
export type AttachmentDependency = z.infer<typeof attachmentDependencySchema>;

export const confidenceSchema = z.enum(["high", "medium", "low", "disputed", "unverified"]);
export type ConfidenceLevel = z.infer<typeof confidenceSchema>;

export const weaponMetaInputSchema = z.object({
  slug: z.string().min(2),
  components: weaponComponentsSchema,
  availability: availabilityKindSchema,
  attachmentDependency: attachmentDependencySchema,
  confidence: confidenceSchema,
  /** Optional per-mode role-fit adjustment in points (−10..10), keyed by mode slug. */
  roleFit: z.record(z.string(), z.number().min(-10).max(10)).default({}),
});
export type WeaponMetaInput = z.infer<typeof weaponMetaInputSchema>;

/** Scoring context for a mode (spec §10: weights are explicit, never hidden). */
export const modeContextSchema = z
  .object({
    modeSlug: z.string().min(2),
    rangeWeights: z.object({
      close: z.number().min(0).max(1),
      mid: z.number().min(0).max(1),
      long: z.number().min(0).max(1),
    }),
    /** How much ease-of-use matters in this mode (0–1). */
    easeWeight: z.number().min(0).max(1),
    /** null = mode rule unknown/depends on player choice. */
    aimAssist: z.enum(["allowed", "disabled"]).nullable(),
  })
  .refine(
    (ctx) => {
      const sum = ctx.rangeWeights.close + ctx.rangeWeights.mid + ctx.rangeWeights.long;
      return Math.abs(sum - 1) < 1e-9;
    },
    { message: "rangeWeights must sum to 1" },
  );
export type ModeContext = z.infer<typeof modeContextSchema>;

export interface ScoreLine {
  /** Human-readable explanation of this contribution. */
  label: string;
  /** Signed points contributed to the overall score. */
  points: number;
}

export interface TierResult {
  slug: string;
  modeSlug: string;
  score: number;
  tier: TierLetter;
  /** Every contribution, in application order — sums to `score` (pre-clamp). */
  breakdown: ScoreLine[];
  /** True when clamping to [0,100] changed the raw sum. */
  clamped: boolean;
  availabilityAdjusted: boolean;
  methodology: { slug: string; version: string };
  /** Present when an editor overrode the computed tier. */
  override?: { tier: TierLetter; reason: string };
  /** Final tier after any override. */
  effectiveTier: TierLetter;
}
