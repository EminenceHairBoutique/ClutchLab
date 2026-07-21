import type { ModeContext } from "./types";

/**
 * Per-mode scoring contexts (spec §5.3 "do not rank all ranges together").
 * Weights are editorial, versioned with the methodology, and shown to users
 * as part of every tier explanation.
 */
export const MODE_CONTEXTS: Record<string, ModeContext> = {
  classic_ranked: {
    modeSlug: "classic_ranked",
    rangeWeights: { close: 0.3, mid: 0.45, long: 0.25 },
    easeWeight: 0.5,
    aimAssist: "allowed",
  },
  classic_casual: {
    modeSlug: "classic_casual",
    rangeWeights: { close: 0.3, mid: 0.45, long: 0.25 },
    easeWeight: 0.7,
    aimAssist: "allowed",
  },
  ultimate_royale: {
    modeSlug: "ultimate_royale",
    rangeWeights: { close: 0.3, mid: 0.45, long: 0.25 },
    easeWeight: 0.3,
    aimAssist: "disabled",
  },
  ranked_arena: {
    modeSlug: "ranked_arena",
    rangeWeights: { close: 0.65, mid: 0.3, long: 0.05 },
    easeWeight: 0.4,
    aimAssist: "allowed",
  },
  arena_casual: {
    modeSlug: "arena_casual",
    rangeWeights: { close: 0.65, mid: 0.3, long: 0.05 },
    easeWeight: 0.6,
    aimAssist: "allowed",
  },
};

export function contextForMode(modeSlug: string): ModeContext {
  const ctx = MODE_CONTEXTS[modeSlug];
  if (!ctx) {
    throw new Error(`No scoring context defined for mode "${modeSlug}"`);
  }
  return ctx;
}
