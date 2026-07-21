import type { Metadata } from "next";

import { PhasePlaceholder } from "@/components/phase-placeholder";

export const metadata: Metadata = {
  title: "Controls",
  description: "Control Layout Studio: visual HUD editor with ergonomic analysis.",
};

export default function ControlsPage() {
  return (
    <PhasePlaceholder
      title="Controls"
      description="Design 2- to 6-finger layouts and find input congestion before it costs a fight."
      phase={5}
      planned={[
        "Visual HUD editor with draggable control elements (original assets only)",
        "Two- through six-finger, tablet, left-handed, and accessibility layouts",
        "Ergonomic analysis: finger travel, thumb workload, collision and reach risks",
        "Heat map plus concrete findings and suggested element moves",
        "Layout test drills: scope-fire, peek-fire, crouch spray, jump shot, swaps",
        "Versioned layout storage and sharing",
      ]}
    />
  );
}
