import type { MapRecord } from "../schemas";

const EDITORIAL = {
  dataStatus: "unverified" as const,
  sourceName: "ClutchLab editorial baseline (pending verification)",
  sourceUrl: null,
  sourceDate: "2026-07-21",
};

const ROTATION_NOTE =
  "4.5 availability unconfirmed — the Mobile ranked rotation could not be verified this pass (DATA_VERIFICATION.md).";

/**
 * Long-standing PUBG Mobile map catalog. Map ENTITIES are stable; per-version
 * availability is intentionally null until verified (no invented rotations).
 */
export const MAPS: MapRecord[] = [
  {
    slug: "erangel",
    name: "Erangel",
    sizeKm: 8,
    terrain: "Mixed farmland, military base, rolling hills",
    description: "The original 8×8 battleground; balanced engagement ranges and compound play.",
    availableInSeedVersion: null,
    availabilityNote: ROTATION_NOTE,
    ...EDITORIAL,
  },
  {
    slug: "miramar",
    name: "Miramar",
    sizeKm: 8,
    terrain: "Desert, ridgelines, sparse cover",
    description: "Long sightlines reward DMRs, snipers, and disciplined rotations.",
    availableInSeedVersion: null,
    availabilityNote: ROTATION_NOTE,
    ...EDITORIAL,
  },
  {
    slug: "sanhok",
    name: "Sanhok",
    sizeKm: 4,
    terrain: "Dense jungle, rivers, compounds",
    description: "Fast 4×4 pacing with close- to mid-range fights and heavy foliage.",
    availableInSeedVersion: null,
    availabilityNote: ROTATION_NOTE,
    ...EDITORIAL,
  },
  {
    slug: "vikendi",
    name: "Vikendi",
    sizeKm: 6,
    terrain: "Snow, villages, open fields",
    description: "Mid-size snow map; tracks in snow and varied engagement ranges.",
    availableInSeedVersion: null,
    availabilityNote: ROTATION_NOTE,
    ...EDITORIAL,
  },
  {
    slug: "livik",
    name: "Livik",
    sizeKm: 2,
    terrain: "Nordic valleys, waterfalls, small compounds",
    description: "The 2×2 sprint map: constant fights, fast zones, exclusive weapons historically.",
    availableInSeedVersion: null,
    availabilityNote: ROTATION_NOTE,
    ...EDITORIAL,
  },
  {
    slug: "karakin",
    name: "Karakin",
    sizeKm: 2,
    terrain: "Arid rock, tunnels, destructible walls",
    description: "Small hardcore map with breach mechanics and sticky bombs.",
    availableInSeedVersion: null,
    availabilityNote: ROTATION_NOTE,
    ...EDITORIAL,
  },
  {
    slug: "nusa",
    name: "Nusa",
    sizeKm: 1,
    terrain: "Tropical island resort",
    description: "The smallest map — instant action, vertical resort fights.",
    availableInSeedVersion: null,
    availabilityNote: ROTATION_NOTE,
    ...EDITORIAL,
  },
  {
    slug: "rondo",
    name: "Rondo",
    sizeKm: 8,
    terrain: "East-Asian countryside, urban centers, rivers",
    description: "The newest 8×8: dense urban blocks beside open farmland.",
    availableInSeedVersion: null,
    availabilityNote: ROTATION_NOTE,
    ...EDITORIAL,
  },
];
