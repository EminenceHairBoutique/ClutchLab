import { Badge } from "@clutchlab/ui";
import type { Enums } from "@clutchlab/types";

const LABEL: Record<Enums<"verification_level">, { text: string; variant: "success" | "accent" | "warning" | "danger" | "outline" | "default" }> = {
  player_verified: { text: "player verified", variant: "success" },
  team_verified: { text: "team verified", variant: "success" },
  direct_visual: { text: "direct visual source", variant: "accent" },
  source_verified: { text: "source verified", variant: "accent" },
  community_submitted: { text: "community submitted", variant: "warning" },
  unverified: { text: "unverified", variant: "outline" },
  expired: { text: "expired", variant: "danger" },
  sample: { text: "SAMPLE (fictional)", variant: "warning" },
};

/** Verification label (spec §5.8) — always visible, never implied. */
export function VerificationBadge({ level }: { level: Enums<"verification_level"> }) {
  const { text, variant } = LABEL[level];
  return <Badge variant={variant}>{text}</Badge>;
}
