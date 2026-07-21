import type { Metadata } from "next";

import { PhasePlaceholder } from "@/components/phase-placeholder";

export const metadata: Metadata = {
  title: "Training",
  description: "Structured drills, daily plans, and measurable improvement tracking.",
};

export default function TrainingPage() {
  return (
    <PhasePlaceholder
      title="Training"
      description="A complete curriculum for aim, recoil, movement, audio, and decisions."
      phase={4}
      planned={[
        "Drill library with objectives, passing scores, and coaching cues",
        "Daily plan generator for 5–60 minute sessions, adapted to your weaknesses",
        "Session tracking with accuracy, spray-group, and target-switch metrics",
        "Benchmarks and weekly reports that reward deliberate practice, not volume",
        "World of Wonder drill directory with verified map codes",
        "Ultimate Royale readiness program (aim assist off)",
      ]}
    />
  );
}
