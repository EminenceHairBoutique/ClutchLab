import * as React from "react";

import { cn } from "../lib/cn";

export const TIERS = ["S", "A", "B", "C", "D", "F"] as const;
export type Tier = (typeof TIERS)[number];

const tierClasses: Record<Tier, string> = {
  S: "bg-tier-s/15 text-tier-s border-tier-s/40",
  A: "bg-tier-a/15 text-tier-a border-tier-a/40",
  B: "bg-tier-b/15 text-tier-b border-tier-b/40",
  C: "bg-tier-c/15 text-tier-c border-tier-c/40",
  D: "bg-tier-d/15 text-tier-d border-tier-d/40",
  F: "bg-tier-f/15 text-tier-f border-tier-f/40",
};

export interface TierBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tier: Tier;
}

/**
 * Tier chip. The letter itself is always rendered so color is never the sole
 * carrier of meaning (spec §7.2 color-independent tier labels).
 */
export function TierBadge({ tier, className, ...props }: TierBadgeProps) {
  return (
    <span
      aria-label={`Tier ${tier}`}
      className={cn(
        "inline-flex h-7 w-7 items-center justify-center rounded-md border font-mono text-sm font-bold",
        tierClasses[tier],
        className,
      )}
      {...props}
    >
      {tier}
    </span>
  );
}
