import { z } from "zod";

/**
 * SAMPLE pro/creator profiles (spec §21: "clearly marked as sample").
 *
 * Every profile here is FICTIONAL — invented gamer tags, teams, and settings
 * that demonstrate the vault, comparison, and fork features without attributing
 * fabricated settings to real people (spec §11.3: never fabricate a pro's
 * settings). verification='sample' and data_status='sample' at the row level;
 * the UI additionally labels them. Real verified profiles enter through the
 * §12 editorial workflow with sources.
 */

export const proValueSchema = z.object({
  family: z.enum(["camera", "ads", "gyro", "ads_gyro", "free_look"]),
  scope: z
    .enum(["no_scope_tpp", "no_scope_fpp", "red_dot", "x2", "x3", "x4", "x6", "x8"])
    .nullable(),
  value: z.number().int().min(1).max(300),
});

export const proProfileSchema = z.object({
  slug: z.string().regex(/^[a-z0-9_-]{2,50}$/),
  displayName: z.string().min(2),
  teamSlug: z.string().nullable(),
  region: z.string().nullable(),
  role: z.string().nullable(),
  deviceLabel: z.string().nullable(),
  fpsTier: z.string().nullable(),
  fingerCount: z.number().int().min(2).max(6).nullable(),
  gripStyle: z.enum(["thumbs", "claw_3", "claw_4", "claw_5", "claw_6", "hybrid", "other"]).nullable(),
  gyroMode: z.enum(["off", "scope_on", "always_on"]).nullable(),
  aimAssist: z.enum(["on", "off", "unknown"]),
  preferredWeapons: z.array(z.string()),
  mainModes: z.array(z.string()),
  notes: z.string(),
  values: z.array(proValueSchema).min(6),
});
export type ProProfileRecord = z.infer<typeof proProfileSchema>;

export interface SampleTeam {
  slug: string;
  name: string;
  region: string;
}

export const SAMPLE_TEAMS: SampleTeam[] = [
  { slug: "sample-ionix", name: "IONIX Esports (sample)", region: "SEA" },
  { slug: "sample-graviton", name: "Graviton Gaming (sample)", region: "EU" },
  { slug: "sample-redline", name: "Redline Five (sample)", region: "SA" },
];

const FICTIONAL_NOTE =
  "Fictional sample profile for product demonstration — not a real player. Real profiles enter via the editorial verification workflow.";

const v = (
  family: "camera" | "ads" | "gyro" | "ads_gyro" | "free_look",
  scope: "no_scope_tpp" | "no_scope_fpp" | "red_dot" | "x2" | "x3" | "x4" | "x6" | "x8" | null,
  value: number,
) => ({ family, scope, value });

export const SAMPLE_PROS: ProProfileRecord[] = [
  {
    slug: "sample-novadrift",
    displayName: "NovaDrift",
    teamSlug: "sample-ionix",
    region: "SEA",
    role: "IGL / anchor",
    deviceLabel: "iPhone 15 Pro Max",
    fpsTier: "90 FPS",
    fingerCount: 4,
    gripStyle: "claw_4",
    gyroMode: "scope_on",
    aimAssist: "off",
    preferredWeapons: ["m416", "mini14"],
    mainModes: ["ultimate_royale", "classic_ranked"],
    notes: FICTIONAL_NOTE,
    values: [
      v("camera", "no_scope_tpp", 110), v("camera", "no_scope_fpp", 105), v("camera", "red_dot", 88),
      v("ads", "red_dot", 64), v("ads", "x2", 52), v("ads", "x3", 38), v("ads", "x4", 30),
      v("ads", "x6", 24), v("ads", "x8", 14), v("gyro", "x3", 260), v("free_look", null, 120),
    ],
  },
  {
    slug: "sample-vex",
    displayName: "VexMachina",
    teamSlug: "sample-ionix",
    region: "SEA",
    role: "Entry fragger",
    deviceLabel: "ROG Phone 8 Pro",
    fpsTier: "120 FPS",
    fingerCount: 5,
    gripStyle: "claw_5",
    gyroMode: "always_on",
    aimAssist: "off",
    preferredWeapons: ["m762", "ump45"],
    mainModes: ["ultimate_royale", "ranked_arena"],
    notes: FICTIONAL_NOTE,
    values: [
      v("camera", "no_scope_tpp", 132), v("camera", "red_dot", 102), v("ads", "red_dot", 75),
      v("ads", "x2", 60), v("ads", "x3", 45), v("ads", "x4", 34), v("ads", "x6", 26),
      v("gyro", "x3", 300), v("ads_gyro", "x3", 280), v("free_look", null, 140),
    ],
  },
  {
    slug: "sample-quietpine",
    displayName: "QuietPine",
    teamSlug: "sample-graviton",
    region: "EU",
    role: "Sniper / scout",
    deviceLabel: "iPad Pro 11",
    fpsTier: "120 FPS",
    fingerCount: 6,
    gripStyle: "claw_6",
    gyroMode: "off",
    aimAssist: "on",
    preferredWeapons: ["kar98k", "mk12"],
    mainModes: ["classic_ranked"],
    notes: FICTIONAL_NOTE,
    values: [
      v("camera", "no_scope_tpp", 95), v("camera", "red_dot", 80), v("ads", "red_dot", 58),
      v("ads", "x2", 48), v("ads", "x3", 36), v("ads", "x4", 28), v("ads", "x6", 20),
      v("ads", "x8", 10), v("free_look", null, 110),
    ],
  },
  {
    slug: "sample-krait",
    displayName: "Krait",
    teamSlug: "sample-graviton",
    region: "EU",
    role: "Support",
    deviceLabel: "Galaxy S24 Ultra",
    fpsTier: "120 FPS",
    fingerCount: 4,
    gripStyle: "claw_4",
    gyroMode: "scope_on",
    aimAssist: "off",
    preferredWeapons: ["scarl", "slr"],
    mainModes: ["ultimate_royale", "classic_ranked"],
    notes: FICTIONAL_NOTE,
    values: [
      v("camera", "no_scope_tpp", 118), v("camera", "red_dot", 92), v("ads", "red_dot", 66),
      v("ads", "x2", 54), v("ads", "x3", 40), v("ads", "x4", 31), v("ads", "x6", 24),
      v("gyro", "x3", 240), v("free_look", null, 130),
    ],
  },
  {
    slug: "sample-mirage7",
    displayName: "Mirage7",
    teamSlug: "sample-redline",
    region: "SA",
    role: "Entry fragger",
    deviceLabel: "POCO F5",
    fpsTier: "90 FPS",
    fingerCount: 3,
    gripStyle: "claw_3",
    gyroMode: "off",
    aimAssist: "on",
    preferredWeapons: ["akm", "vector"],
    mainModes: ["classic_ranked", "arena_casual"],
    notes: FICTIONAL_NOTE,
    values: [
      v("camera", "no_scope_tpp", 125), v("camera", "red_dot", 100), v("ads", "red_dot", 72),
      v("ads", "x2", 58), v("ads", "x3", 44), v("ads", "x4", 33), v("ads", "x6", 25),
      v("free_look", null, 118),
    ],
  },
  {
    slug: "sample-tundra",
    displayName: "TundraOak",
    teamSlug: "sample-redline",
    region: "SA",
    role: "IGL",
    deviceLabel: "iPhone 13",
    fpsTier: "60 FPS",
    fingerCount: 2,
    gripStyle: "thumbs",
    gyroMode: "off",
    aimAssist: "on",
    preferredWeapons: ["m416", "sks"],
    mainModes: ["classic_ranked"],
    notes: FICTIONAL_NOTE,
    values: [
      v("camera", "no_scope_tpp", 100), v("camera", "red_dot", 85), v("ads", "red_dot", 60),
      v("ads", "x2", 50), v("ads", "x3", 37), v("ads", "x4", 29), v("ads", "x6", 22),
      v("free_look", null, 100),
    ],
  },
  {
    slug: "sample-lumen",
    displayName: "LumenShot",
    teamSlug: null,
    region: "MENA",
    role: "Creator / coach",
    deviceLabel: "OnePlus 12",
    fpsTier: "120 FPS",
    fingerCount: 4,
    gripStyle: "claw_4",
    gyroMode: "always_on",
    aimAssist: "off",
    preferredWeapons: ["ace32", "mk12"],
    mainModes: ["ultimate_royale", "wow"],
    notes: FICTIONAL_NOTE,
    values: [
      v("camera", "no_scope_tpp", 115), v("camera", "red_dot", 90), v("ads", "red_dot", 62),
      v("ads", "x2", 51), v("ads", "x3", 39), v("ads", "x4", 30), v("ads", "x6", 23),
      v("gyro", "x3", 290), v("ads_gyro", "x3", 270), v("free_look", null, 125),
    ],
  },
  {
    slug: "sample-hexa",
    displayName: "HexaByte",
    teamSlug: null,
    region: "NA",
    role: "Creator",
    deviceLabel: "Pixel 8 Pro",
    fpsTier: "90 FPS",
    fingerCount: 4,
    gripStyle: "hybrid",
    gyroMode: "scope_on",
    aimAssist: "on",
    preferredWeapons: ["aug", "mini14"],
    mainModes: ["classic_casual", "classic_ranked"],
    notes: FICTIONAL_NOTE,
    values: [
      v("camera", "no_scope_tpp", 108), v("camera", "red_dot", 86), v("ads", "red_dot", 63),
      v("ads", "x2", 52), v("ads", "x3", 40), v("ads", "x4", 31), v("ads", "x6", 24),
      v("gyro", "x3", 220), v("free_look", null, 115),
    ],
  },
  {
    slug: "sample-rushlily",
    displayName: "RushLily",
    teamSlug: null,
    region: "SEA",
    role: "Arena specialist",
    deviceLabel: "iQOO 11",
    fpsTier: "120 FPS",
    fingerCount: 5,
    gripStyle: "claw_5",
    gyroMode: "off",
    aimAssist: "on",
    preferredWeapons: ["ump45", "m1014"],
    mainModes: ["ranked_arena", "arena_casual"],
    notes: FICTIONAL_NOTE,
    values: [
      v("camera", "no_scope_tpp", 140), v("camera", "red_dot", 112), v("ads", "red_dot", 82),
      v("ads", "x2", 64), v("ads", "x3", 48), v("ads", "x4", 36), v("ads", "x6", 27),
      v("free_look", null, 135),
    ],
  },
  {
    slug: "sample-stoneveil",
    displayName: "StoneVeil",
    teamSlug: null,
    region: "KR/JP",
    role: "Anchor",
    deviceLabel: "Sample budget device (60 Hz)",
    fpsTier: "60 FPS",
    fingerCount: 3,
    gripStyle: "claw_3",
    gyroMode: "off",
    aimAssist: "on",
    preferredWeapons: ["dp28", "kar98k"],
    mainModes: ["classic_ranked"],
    notes: FICTIONAL_NOTE,
    values: [
      v("camera", "no_scope_tpp", 92), v("camera", "red_dot", 78), v("ads", "red_dot", 56),
      v("ads", "x2", 46), v("ads", "x3", 35), v("ads", "x4", 27), v("ads", "x6", 21),
      v("free_look", null, 105),
    ],
  },
];
