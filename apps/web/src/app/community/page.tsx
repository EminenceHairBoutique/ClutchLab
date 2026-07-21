import type { Metadata } from "next";

import { PhasePlaceholder } from "@/components/phase-placeholder";

export const metadata: Metadata = {
  title: "Community",
  description: "Moderated settings posts, drill results, meta debates, and squad recruitment.",
};

export default function CommunityPage() {
  return (
    <PhasePlaceholder
      title="Community"
      description="Share results, debate the meta, find a squad — with real moderation."
      phase={6}
      planned={[
        "Settings and layout posts, drill results, and Q&A",
        "Pro-profile correction requests routed to editors",
        "Source requirements for factual claims; reputation and expert badges",
        "Reporting, moderator queue, and appeals",
        "Zero tolerance for cheats, macros, modified clients, or account trading",
        "Squad recruitment and coaching reviews",
      ]}
    />
  );
}
