import type { GameVersionRecord, PatchRecord, SeasonRecord } from "../schemas";

/**
 * Version/season baseline per DATA_VERIFICATION.md claims C1–C3, C7.
 * Everything is data_status='unverified' — sources are secondary.
 */

export const GAME_VERSION_45: GameVersionRecord = {
  version: "4.5",
  editionSlug: "global",
  releasedOn: "2026-07-09",
  windowEnd: "2026-09-07",
  headline:
    "Naruto Shippuden themed mode, Sea Odyssey return, Spider-Man collab (from Jul 30), ACE32 and SMG balance changes",
  confidence: "medium",
  notes: "Claim C1 in DATA_VERIFICATION.md; window end pending official confirmation.",
  dataStatus: "unverified",
  sourceName: "vpesports / SportsDunia / EnjoyGM (secondary, corroborating)",
  sourceUrl: "https://vpesports.com/games/pubg/pubg-mobile-summer-2026",
  sourceDate: "2026-07-21",
};

export const SEASONS: SeasonRecord[] = [
  {
    slug: "s31-classic",
    kind: "classic",
    name: "S31 Classic Season",
    startsAt: "2026-07-16T00:00:00Z",
    endsAt: "2026-09-11T23:59:59Z",
    editionSlug: "global",
    confidence: "medium",
    notes: "Claim C2; matches spec baseline exactly.",
    dataStatus: "unverified",
    sourceName: "TopupLive / SportsDunia (secondary, corroborating)",
    sourceUrl: "https://www.topuplive.com/news/pubg-mobile-season-31-update.html",
    sourceDate: "2026-07-21",
  },
  {
    slug: "s31-ultimate-royale",
    kind: "ultimate_royale",
    name: "S31 Ultimate Royale",
    startsAt: "2026-07-20T00:00:00Z",
    endsAt: "2026-09-07T23:59:59Z",
    editionSlug: "global",
    confidence: "low",
    notes:
      "Claim C3: start corroborated; end date inferred from the version window and spec baseline — review task open.",
    dataStatus: "unverified",
    sourceName: "TopupLive (secondary)",
    sourceUrl: "https://www.topuplive.com/news/pubg-mobile-season-31-update.html",
    sourceDate: "2026-07-21",
  },
  {
    slug: "45-casual",
    kind: "casual",
    name: "Version 4.5 Casual Season",
    startsAt: null,
    endsAt: null,
    editionSlug: "global",
    confidence: "unverified",
    notes:
      "Spec §2.1 baseline says 4.5 includes a Casual Season with Season Points from eligible unranked modes; dates not verified this pass.",
    dataStatus: "unverified",
    sourceName: "ClutchLab editorial baseline (pending verification)",
    sourceUrl: null,
    sourceDate: "2026-07-21",
  },
];

export const PATCH_45: PatchRecord = {
  name: "4.5.0",
  publishedOn: "2026-07-09",
  summary:
    "Version 4.5 launch patch: themed-mode content plus weapon balance adjustments (ACE32 recoil/animation, SMG mobility).",
  dataStatus: "unverified",
  sourceName: "SportsDunia balance coverage + GamesPress release (secondary/press)",
  sourceUrl: "https://www.sportsdunia.com/gaming/pubg-mobile-4-4-beta-weapon-balance-changes",
  sourceDate: "2026-07-21",
  changes: [
    {
      key: "ace32-recoil",
      changeType: "buff",
      area: "weapon",
      targetSlug: "ace32",
      summary: "ACE32 firing animation and recoil improved for better control.",
      detail:
        "Magnitude unknown — no numeric recoil deltas may be stored until official notes or reproducible measurements exist (claim C4).",
      confidence: "low",
      dataStatus: "unverified",
      sourceName: "SportsDunia balance coverage",
      sourceUrl: "https://www.sportsdunia.com/gaming/pubg-mobile-4-4-beta-weapon-balance-changes",
      sourceDate: "2026-07-21",
    },
    {
      key: "smg-mobility",
      changeType: "buff",
      area: "weapon",
      targetSlug: null,
      summary:
        "SMG class: sprint speed no longer reduced while an SMG is equipped; moving bullet spread reduced.",
      detail:
        "Which SMGs are affected is unconfirmed — stored as a class-level note, not per-weapon stats (claim C5).",
      confidence: "low",
      dataStatus: "unverified",
      sourceName: "SportsDunia balance coverage",
      sourceUrl: "https://www.sportsdunia.com/gaming/pubg-mobile-4-4-beta-weapon-balance-changes",
      sourceDate: "2026-07-21",
    },
    {
      key: "naruto-mode",
      changeType: "new",
      area: "mode",
      targetSlug: null,
      summary: "Naruto: Ninjas Assemble themed mode on reworked Erangel locations.",
      detail: "Claim C7 (official press release via GamesPress).",
      confidence: "medium",
      dataStatus: "unverified",
      sourceName: "GamesPress official release",
      sourceUrl:
        "https://www.gamespress.com/PUBG-MOBILES-VERSION-45-UPDATE-INTRODUCES-ONE-OF-ITS-BIGGEST-EVER-COLL",
      sourceDate: "2026-07-21",
    },
    {
      key: "sea-odyssey-return",
      changeType: "new",
      area: "mode",
      targetSlug: null,
      summary: "Sea Odyssey mode returns (underwater ruins, last seen in 3.3).",
      detail: null,
      confidence: "low",
      dataStatus: "unverified",
      sourceName: "u7buy / EnjoyGM coverage (secondary)",
      sourceUrl: "https://www.enjoygm.com/blog/pubg-mobile/pubg-mobile-4-5-update",
      sourceDate: "2026-07-21",
    },
    {
      key: "spiderman-collab",
      changeType: "new",
      area: "mode",
      targetSlug: null,
      summary: "Spider-Man collaboration from 2026-07-30 with web-swinging traversal.",
      detail: null,
      confidence: "low",
      dataStatus: "unverified",
      sourceName: "u7buy coverage (secondary)",
      sourceUrl: "https://www.u7buy.com/blog/new-update-pubg-mobile-4-5/",
      sourceDate: "2026-07-21",
    },
  ],
};
