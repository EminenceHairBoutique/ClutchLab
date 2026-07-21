import type { Metadata } from "next";

import { PhasePlaceholder } from "@/components/phase-placeholder";

export const metadata: Metadata = {
  title: "Maps",
  description: "Map strategy: drops, rotations, chokepoints, and a personal route builder.",
};

export default function MapsPage() {
  return (
    <PhasePlaceholder
      title="Maps"
      description="Original tactical diagrams — drops, rotations, and power positions per map."
      phase={2}
      planned={[
        "Per-map profiles: engagement ranges, loot density, vehicle dependence",
        "Risk-ranked drop guides and rotation choke points",
        "Interactive layers for compounds, ridges, crossings, and endgame terrain",
        "Personal route builder: drop, loot path, backup, rotations, squad assignments",
        "Map-specific weapon and scope meta",
        "Original simplified diagrams only — no copyrighted map assets",
      ]}
    />
  );
}
