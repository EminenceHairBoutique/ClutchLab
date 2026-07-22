/** §5.18 notification kinds — client-safe (no server imports). */

export const NOTIFICATION_KINDS = [
  "new_version",
  "new_season",
  "weapon_changed",
  "attachment_changed",
  "pro_updated",
  "profile_stale",
  "ultimate_royale_start",
  "ranked_arena_start",
  "daily_training",
  "weekly_report",
  "coach_response",
  "community_reply",
] as const;

export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

export const KIND_LABELS: Record<NotificationKind, { label: string; description: string }> = {
  new_version: {
    label: "New PUBG Mobile version",
    description: "A new game version lands in the meta engine.",
  },
  new_season: { label: "New season", description: "A ranked or casual season begins." },
  weapon_changed: {
    label: "Saved weapon changed",
    description: "A patch touches a weapon you follow.",
  },
  attachment_changed: {
    label: "Saved attachment changed",
    description: "A patch touches an attachment you follow.",
  },
  pro_updated: {
    label: "Pro updated settings",
    description: "A pro profile you viewed publishes new values.",
  },
  profile_stale: {
    label: "Profile became stale",
    description: "Your sensitivity profile needs a retest after a patch.",
  },
  ultimate_royale_start: {
    label: "Ultimate Royale starts",
    description: "The mode window opens.",
  },
  ranked_arena_start: { label: "Ranked Arena starts", description: "The mode window opens." },
  daily_training: { label: "Daily training", description: "Your daily practice reminder." },
  weekly_report: { label: "Weekly report", description: "Your weekly training summary is ready." },
  coach_response: {
    label: "Coach activity",
    description: "AI reports finish, bookings move, coaches deliver.",
  },
  community_reply: {
    label: "Community reply",
    description: "Someone comments on your post.",
  },
};
