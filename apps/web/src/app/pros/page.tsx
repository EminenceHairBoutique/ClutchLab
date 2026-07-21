import type { Metadata } from "next";

import { PhasePlaceholder } from "@/components/phase-placeholder";

export const metadata: Metadata = {
  title: "Pros",
  description: "Verified pro settings with sources, staleness rules, and change history.",
};

export default function ProsPage() {
  return (
    <PhasePlaceholder
      title="Pros"
      description="The settings vault — verified, versioned, and honest about staleness."
      phase={3}
      planned={[
        "Pro and creator profiles with device, FPS, grip, and sensitivity details",
        "Verification labels from player-verified down to unverified — always visible",
        "Automatic staleness review when a patch changes relevant settings",
        "Compare a pro's profile to yours; fork it as a starting point",
        "Device compatibility warnings — a tablet config won't map to your phone",
        "Follow players for verified update notifications",
      ]}
    />
  );
}
