import type { Metadata } from "next";

import { PhasePlaceholder } from "@/components/phase-placeholder";

export const metadata: Metadata = {
  title: "Coach",
  description: "Post-match AI review of your uploaded clips — timestamped, honest, actionable.",
};

export default function CoachPage() {
  return (
    <PhasePlaceholder
      title="Coach"
      description="Upload a clip after the match. Get timestamped evidence, not vibes."
      phase={7}
      planned={[
        "Clip and full-match uploads analyzed after gameplay — never live",
        "Three highest-impact mistakes with timestamps, causes, and better alternatives",
        "Assigned drills that target what the review actually found",
        "Confidence scores and a clear list of what the model could not determine",
        "Settings-change suggestions only when multiple samples support them",
        "Human coach marketplace for paid reviews (later phase)",
      ]}
    />
  );
}
