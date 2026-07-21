import type { Metadata } from "next";

import { PhasePlaceholder } from "@/components/phase-placeholder";

export const metadata: Metadata = {
  title: "Weapons",
  description: "Weapon Lab: verified stats, comparisons, TTK exploration, attachment packages.",
};

export default function WeaponsPage() {
  return (
    <PhasePlaceholder
      title="Weapons"
      description="A detailed, versioned page for every firearm."
      phase={2}
      planned={[
        "Weapon pages with class, ammo, fire modes, magazines, and compatibility",
        "Recoil profiles and practical effective ranges with disclosed assumptions",
        "Weapon comparator and time-to-kill / hits-to-kill explorers",
        "Attachment simulator with context-specific presets (no universal “best”)",
        "Primary/secondary pairing recommender by mode, map, role, and ammo overlap",
        "Patch history per weapon — measured, estimated, and disputed values labeled",
      ]}
    />
  );
}
