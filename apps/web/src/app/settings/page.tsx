import type { Metadata } from "next";

import { PhasePlaceholder } from "@/components/phase-placeholder";

export const metadata: Metadata = {
  title: "Settings",
  description: "Setting explainers, the aim assist decision lab, and the sensitivity builder.",
};

export default function SettingsPage() {
  return (
    <PhasePlaceholder
      title="Settings"
      description="Understand every setting — then calibrate your own."
      phase={3}
      planned={[
        "30+ setting explainers: what it does, what it doesn't, and when to retest",
        "Personalized sensitivity builder for every scope and category",
        "Guided calibration flow that changes one variable at a time",
        "Named profiles with version history, comparisons, and rollback",
        "Aim Assist Decision Lab with a structured on/off A/B test",
        "Sensitivity codes stored verbatim as your artifacts — never fabricated",
      ]}
    />
  );
}
