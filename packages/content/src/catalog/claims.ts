import type { ClaimRecord, ReviewTaskRecord } from "../schemas";

/** Claims C1–C7 from DATA_VERIFICATION.md, linked to their sources. */
export const CLAIMS: ClaimRecord[] = [
  {
    slug: "c1-45-launch",
    statement: "PUBG Mobile Version 4.5 launched globally on 2026-07-09 with a window to ~2026-09-07.",
    verdict: "supported",
    confidence: "medium",
    notes: "Three independent secondary sources agree.",
    evidence: [
      { sourceKey: "vpesports-45", supports: true, note: null },
      { sourceKey: "sportsdunia-45", supports: true, note: null },
      { sourceKey: "enjoygm-45", supports: true, note: null },
    ],
    dataStatus: "unverified",
  },
  {
    slug: "c2-s31-classic-dates",
    statement: "S31 Classic Season runs 2026-07-16 through 2026-09-11 (UTC).",
    verdict: "supported",
    confidence: "medium",
    notes: null,
    evidence: [{ sourceKey: "topuplive-s31", supports: true, note: null }],
    dataStatus: "unverified",
  },
  {
    slug: "c3-s31-ur-dates",
    statement: "S31 Ultimate Royale opens 2026-07-20 (UTC) and ends around 2026-09-07.",
    verdict: "partial",
    confidence: "low",
    notes: "Start corroborated; end date inferred, not sourced.",
    evidence: [{ sourceKey: "topuplive-s31", supports: true, note: "Start date only." }],
    dataStatus: "unverified",
  },
  {
    slug: "c4-ace32-recoil",
    statement: "Version 4.5 improved the ACE32's firing animation and recoil control.",
    verdict: "supported",
    confidence: "low",
    notes: "Magnitude unknown; no numeric deltas may be stored.",
    evidence: [{ sourceKey: "sportsdunia-balance", supports: true, note: null }],
    dataStatus: "unverified",
  },
  {
    slug: "c5-smg-mobility",
    statement:
      "Version 4.5 SMG changes: no sprint-speed reduction while equipped and reduced moving bullet spread.",
    verdict: "supported",
    confidence: "low",
    notes: "Which SMGs exactly is unconfirmed.",
    evidence: [{ sourceKey: "sportsdunia-balance", supports: true, note: null }],
    dataStatus: "unverified",
  },
  {
    slug: "c6-ur-ruleset",
    statement:
      "Ultimate Royale disables aim assist and the shop/flare guns, requires Crown tier to enter, and uses esports-standard zones.",
    verdict: "supported",
    confidence: "medium",
    notes: "Long-standing mode rules; per-season diffs unverified.",
    evidence: [{ sourceKey: "gamingonphone-ur", supports: true, note: null }],
    dataStatus: "unverified",
  },
  {
    slug: "c7-45-content",
    statement:
      "4.5 headline content: Naruto Shippuden themed mode, Spider-Man collaboration from 2026-07-30, and the Sea Odyssey mode return.",
    verdict: "supported",
    confidence: "medium",
    notes: "GamesPress is an official PR channel.",
    evidence: [
      { sourceKey: "gamespress-45", supports: true, note: null },
      { sourceKey: "enjoygm-45", supports: true, note: null },
    ],
    dataStatus: "unverified",
  },
];

/** Editorial follow-ups opened by the 2026-07-21 research pass. */
export const REVIEW_TASKS: ReviewTaskRecord[] = [
  {
    key: "capture-official-45-notes",
    title: "Capture official 4.5 patch notes",
    detail:
      "Snapshot the official in-game/website 4.5 patch notes and upgrade claims C1/C4/C5 sources from secondary to official.",
    kind: "verify",
    entityType: "game_version",
    entityId: "4.5",
    priority: "high",
  },
  {
    key: "confirm-ur-end-date",
    title: "Confirm S31 Ultimate Royale end date",
    detail: "The 2026-09-07 end date is inferred (claim C3). Confirm from an official announcement.",
    kind: "verify",
    entityType: "season",
    entityId: "s31-ultimate-royale",
    priority: "medium",
  },
  {
    key: "confirm-45-map-rotation",
    title: "Confirm the 4.5 Mobile map rotation",
    detail:
      "Search results conflated PC PUBG with Mobile. Verify which maps are live in 4.5 Classic (per mode) and fill map_versions.available.",
    kind: "verify",
    entityType: "game_version",
    entityId: "4.5",
    priority: "high",
  },
  {
    key: "source-weapon-balance-details",
    title: "Source per-weapon 4.5 balance details",
    detail:
      "Identify exactly which SMGs changed and the ACE32 adjustment scope; attach official or reproducible-measurement sources before any weapon_stats rows exist.",
    kind: "investigate",
    entityType: "patch",
    entityId: "4.5.0",
    priority: "medium",
  },
];
