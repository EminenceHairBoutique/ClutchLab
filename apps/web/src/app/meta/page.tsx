import type { Metadata } from "next";

import { PhasePlaceholder } from "@/components/phase-placeholder";

export const metadata: Metadata = {
  title: "Meta",
  description: "Mode-, map-, and version-specific PUBG Mobile weapon tiers with evidence.",
};

export default function MetaPage() {
  return (
    <PhasePlaceholder
      title="Meta"
      description="Multidimensional weapon rankings — never one universal tier list."
      phase={2}
      planned={[
        "Tier lists scoped by game version, season, mode, map, range, and skill level",
        "Availability-adjusted rankings (airdrop vs ground loot shown separately)",
        "Why-this-tier explanations with per-component scores and evidence",
        "Previous tier + what changed after each patch",
        "“Best for me” filters using your device and mechanics profile",
        "Editorial, pro-usage, and community tier lists side by side, disputes flagged",
      ]}
    />
  );
}
