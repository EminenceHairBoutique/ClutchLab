import type { ModeRecord } from "../schemas";

const EDITORIAL = {
  dataStatus: "unverified" as const,
  sourceName: "ClutchLab editorial baseline (pending verification)",
  sourceUrl: null,
  sourceDate: "2026-07-21",
};

const UR_SOURCE = {
  dataStatus: "unverified" as const,
  sourceName: "GamingOnPhone — Ultimate Royale mode rules",
  sourceUrl: "https://gamingonphone.com/news/pubg-mobile-ultimate-royale-mode/",
  sourceDate: "2026-07-21",
};

/** Required modes (spec §5.3): the mode catalog the meta engine ranks against. */
export const MODES: ModeRecord[] = [
  {
    slug: "classic_ranked",
    name: "Classic Ranked",
    description:
      "Ranked battle royale on the classic map pool. Rank-safe decision-making balances placement and aggression.",
    aimAssistAllowed: true,
    teamSizes: ["solo", "duo", "squad"],
    rules: [
      { key: "ranking", value: "tiered", note: "Bronze through Conqueror ladder." },
    ],
    ...EDITORIAL,
  },
  {
    slug: "classic_casual",
    name: "Classic (Casual/Unranked)",
    description:
      "Unranked classic battle royale — the low-pressure layer for testing new sensitivity, layouts, and weapons.",
    aimAssistAllowed: true,
    teamSizes: ["solo", "duo", "squad"],
    rules: [
      {
        key: "season_points",
        value: "eligible",
        note: "4.5 supports earning Season Points in eligible unranked modes (spec baseline, unverified).",
      },
    ],
    ...EDITORIAL,
  },
  {
    slug: "ultimate_royale",
    name: "Ultimate Royale",
    description:
      "The competitive ruleset: esports-standard zones and loot, no aim assist — the closest ladder to tournament play.",
    aimAssistAllowed: false,
    teamSizes: ["squad"],
    rules: [
      { key: "aim_assist", value: "disabled", note: "Claim C6." },
      { key: "shop", value: "disabled", note: "No in-match shop; flare guns unavailable." },
      { key: "entry", value: "crown_tier", note: "Crown tier in current or previous season required." },
      { key: "zones", value: "esports_standard", note: "Playzone shrink, blue zone, supply rates per esports standard; no red zone." },
    ],
    ...UR_SOURCE,
  },
  {
    slug: "ranked_arena",
    name: "Ranked Arena",
    description:
      "Close-quarters ranked arena: repeated engagements, spawn awareness, and loadout mastery at short time-to-kill.",
    aimAssistAllowed: null,
    teamSizes: ["squad"],
    rules: [],
    ...EDITORIAL,
  },
  {
    slug: "arena_casual",
    name: "Arena / TDM (Unranked)",
    description: "Unranked arena and team deathmatch — warmups, tracking practice, and layout testing.",
    aimAssistAllowed: null,
    teamSizes: ["solo", "duo", "squad"],
    rules: [],
    ...EDITORIAL,
  },
  {
    slug: "wow",
    name: "World of Wonder",
    description:
      "Creator-built training and custom maps — the home of aim, recoil, and movement drill maps.",
    aimAssistAllowed: null,
    teamSizes: ["custom"],
    rules: [],
    ...EDITORIAL,
  },
  {
    slug: "metro",
    name: "Metro Royale",
    description:
      "Extraction-style mode with persistent gear. Tracked as a separate future module (spec §5.3).",
    aimAssistAllowed: null,
    teamSizes: ["solo", "duo", "squad"],
    rules: [],
    ...EDITORIAL,
  },
];
