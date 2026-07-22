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
    "Naruto Shippuden themed mode, Ferrari & Spider-Man (Jul 30) collabs, Sea Odyssey return, " +
    "Fast Swim + Monster Truck handling, ACE32/SMG balance",
  confidence: "medium",
  notes:
    "Claims C1/C8 in DATA_VERIFICATION.md; window end pending official confirmation. " +
    "Enriched 2026-07-22 with Ferrari collab, Fast Swim, Monster Truck, and Metro Royale Ch.33 " +
    "(GamesPress official + press corroboration).",
  dataStatus: "unverified",
  sourceName: "GamesPress (official) + SportsDunia / The Magic Rain (press, corroborating)",
  sourceUrl:
    "https://www.gamespress.com/PUBG-MOBILES-VERSION-45-UPDATE-INTRODUCES-ONE-OF-ITS-BIGGEST-EVER-COLL",
  sourceDate: "2026-07-22",
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
    "Version 4.5 launch patch: themed-mode content, collab events (Naruto, Ferrari, Spider-Man), " +
    "movement additions (Fast Swim, Monster Truck handling), and weapon balance (ACE32, SMG mobility).",
  dataStatus: "unverified",
  sourceName: "GamesPress official release + SportsDunia / The Magic Rain (press)",
  sourceUrl:
    "https://www.gamespress.com/PUBG-MOBILES-VERSION-45-UPDATE-INTRODUCES-ONE-OF-ITS-BIGGEST-EVER-COLL",
  sourceDate: "2026-07-22",
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
      summary: "Naruto: Ninjas Assemble themed mode across Erangel, Livik, and Sanhok.",
      detail:
        "Claim C7 (official press release via GamesPress); map list (Erangel/Livik/Sanhok) corroborated 2026-07-22.",
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
    {
      key: "ferrari-collab",
      changeType: "new",
      area: "other",
      targetSlug: null,
      summary: "Scuderia Ferrari HP collaboration arrives in July with exclusive Ferrari content.",
      detail: "Claim C8: named in the official GamesPress release alongside the Naruto headline.",
      confidence: "medium",
      dataStatus: "unverified",
      sourceName: "GamesPress official release",
      sourceUrl:
        "https://www.gamespress.com/PUBG-MOBILES-VERSION-45-UPDATE-INTRODUCES-ONE-OF-ITS-BIGGEST-EVER-COLL",
      sourceDate: "2026-07-22",
    },
    {
      key: "fast-swim",
      changeType: "new",
      area: "movement",
      targetSlug: null,
      summary: "New Fast Swim mechanic: propel forward through water for short bursts.",
      detail:
        "Claim C8: movement addition affecting aquatic mobility; magnitudes unmeasured, no numbers stored.",
      confidence: "medium",
      dataStatus: "unverified",
      sourceName: "GamesPress official + The Magic Rain (press)",
      sourceUrl:
        "https://themagicrain.com/2026/07/pubg-mobile-version-4-5-update-launches-with-naruto-shippuden-collaboration/",
      sourceDate: "2026-07-22",
    },
    {
      key: "monster-truck-handling",
      changeType: "adjustment",
      area: "movement",
      targetSlug: null,
      summary: "Monster Truck driving stability / handling improved.",
      detail: "Claim C8: vehicle handling tweak; direction improves, magnitude unmeasured.",
      confidence: "low",
      dataStatus: "unverified",
      sourceName: "SportsDunia coverage (press)",
      sourceUrl: "https://www.sportsdunia.com/gaming/pubg-mobile-4-5-update-to-go-live",
      sourceDate: "2026-07-22",
    },
    {
      key: "metro-royale-ch33",
      changeType: "new",
      area: "mode",
      targetSlug: null,
      summary:
        "Metro Royale Chapter 33: Naruto Shippuden-inspired encounters, progression, and seasonal rewards.",
      detail: "Claim C8: Metro Royale seasonal chapter update.",
      confidence: "low",
      dataStatus: "unverified",
      sourceName: "SportsDunia coverage (press)",
      sourceUrl: "https://www.sportsdunia.com/gaming/pubg-mobile-4-5-update-to-go-live",
      sourceDate: "2026-07-22",
    },
  ],
};
