/**
 * Plan entitlements (spec §14). The ONLY place feature access is defined —
 * "use entitlements, not scattered hard-coded plan checks". Stores and UI ask
 * these helpers; they never compare plan strings themselves.
 */

export const PLAN_TIERS = ["free", "pro", "elite"] as const;
export type PlanTier = (typeof PLAN_TIERS)[number];

export const PAID_PLANS = ["pro", "elite"] as const;
export type PaidPlan = (typeof PAID_PLANS)[number];

/** Mirrors public.upload_kind — kept as strings to stay dependency-free. */
export type CoachUploadKind =
  | "clip"
  | "full_match"
  | "training_grounds"
  | "arena_match"
  | "screenshot"
  | "settings_screenshot"
  | "controls_screenshot"
  | "results_screenshot";

const ALL_KINDS: readonly CoachUploadKind[] = [
  "clip",
  "full_match",
  "training_grounds",
  "arena_match",
  "screenshot",
  "settings_screenshot",
  "controls_screenshot",
  "results_screenshot",
];

const NON_MATCH_KINDS: readonly CoachUploadKind[] = ALL_KINDS.filter((k) => k !== "full_match");

export type Limit = number | "unlimited";

export interface PlanEntitlements {
  /** AI coach analyses per calendar month (0 = feature not included). */
  coachAnalysesPerMonth: number;
  /** Upload kinds the coach accepts on this plan (§14: full-match is Elite). */
  coachUploadKinds: readonly CoachUploadKind[];
  /** Saved sensitivity profiles (§14 Free: one). */
  sensitivityProfiles: Limit;
  /** Saved control layouts (§14 Free: one). */
  controlLayouts: Limit;
  /** Full pro settings vault vs the limited free selection. */
  fullProVault: boolean;
  /** Marketplace coach-session discount (§14 Elite). */
  coachDiscount: boolean;
}

const PLANS: Record<PlanTier, PlanEntitlements> = {
  free: {
    coachAnalysesPerMonth: 0,
    coachUploadKinds: [],
    sensitivityProfiles: 1,
    controlLayouts: 1,
    fullProVault: false,
    coachDiscount: false,
  },
  pro: {
    coachAnalysesPerMonth: 10,
    coachUploadKinds: NON_MATCH_KINDS,
    sensitivityProfiles: "unlimited",
    controlLayouts: "unlimited",
    fullProVault: true,
    coachDiscount: false,
  },
  elite: {
    coachAnalysesPerMonth: 30,
    coachUploadKinds: ALL_KINDS,
    sensitivityProfiles: "unlimited",
    controlLayouts: "unlimited",
    fullProVault: true,
    coachDiscount: true,
  },
};

export function entitlementsFor(plan: PlanTier): PlanEntitlements {
  return PLANS[plan];
}

export function isPlanTier(value: string): value is PlanTier {
  return (PLAN_TIERS as readonly string[]).includes(value);
}

/** True when `used` stays under the limit (i.e. one more is allowed). */
export function withinLimit(limit: Limit, used: number): boolean {
  return limit === "unlimited" || used < limit;
}

export function canAnalyzeKind(plan: PlanTier, kind: string): boolean {
  return (entitlementsFor(plan).coachUploadKinds as readonly string[]).includes(kind);
}

/** Human-readable §14 plan summaries for the billing page. */
export const PLAN_SUMMARIES: Record<
  PlanTier,
  { name: string; priceNote: string; highlights: string[] }
> = {
  free: {
    name: "Free",
    priceNote: "$0",
    highlights: [
      "Current version summary and limited meta access",
      "Basic sensitivity builder — one saved profile",
      "One control layout",
      "Basic drills and weekly summary",
      "Community access",
    ],
  },
  pro: {
    name: "Pro",
    priceNote: "test range $4.99–$7.99/mo",
    highlights: [
      "Full meta engine, weapons, and attachment tools",
      "Unlimited sensitivity profiles + advanced calibration",
      "Unlimited layouts + control ergonomics",
      "Personalized training and patch impact alerts",
      "Full pro vault",
      "10 AI clip reviews per month",
    ],
  },
  elite: {
    name: "Elite",
    priceNote: "test range $12.99–$19.99/mo",
    highlights: [
      "Everything in Pro",
      "30 AI analyses per month, including full-match reviews",
      "Ultimate Royale preparation",
      "Advanced reports",
      "Coach session discounts",
    ],
  },
};
