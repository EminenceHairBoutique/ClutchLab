import "server-only";

import type { Enums } from "@clutchlab/types";

import { authMode } from "@/lib/auth/gateway";

/**
 * Read-side store for versioned meta content. Two implementations:
 * - supabase: live database through the user's session (RLS applies)
 * - bundled: the same editorial baseline the seed was generated from, served
 *   when Supabase is not configured. Provenance is always surfaced in the UI.
 */

export type Provenance = "database" | "bundled-baseline";

export interface ScoreLine {
  label: string;
  points: number;
}

export interface VersionIntel {
  provenance: Provenance;
  version: {
    version: string;
    releasedOn: string | null;
    windowEnd: string | null;
    headline: string | null;
    dataStatus: Enums<"data_status">;
    confidence: Enums<"confidence_level">;
    sourceName: string | null;
    sourceUrl: string | null;
  } | null;
  seasons: Array<{
    slug: string;
    name: string;
    kind: Enums<"season_kind">;
    startsAt: string | null;
    endsAt: string | null;
    dataStatus: Enums<"data_status">;
    confidence: Enums<"confidence_level">;
    notes: string | null;
  }>;
  changes: Array<{
    summary: string;
    detail: string | null;
    changeType: Enums<"change_type">;
    area: Enums<"change_area">;
    targetSlug: string | null;
    confidence: Enums<"confidence_level">;
    dataStatus: Enums<"data_status">;
  }>;
}

export interface TierEntry {
  weaponSlug: string;
  weaponName: string;
  weaponClass: Enums<"weapon_class">;
  availability: Enums<"availability_kind">;
  description: string | null;
  tier: Enums<"tier_letter">;
  score: number | null;
  breakdown: ScoreLine[];
  rangeProfile: { close: number; mid: number; long: number } | null;
  difficulty: Enums<"difficulty_level">;
  confidence: Enums<"confidence_level">;
  evidenceNote: string | null;
  changeNote: string | null;
  dataStatus: Enums<"data_status">;
}

export interface TierBoard {
  provenance: Provenance;
  modeSlug: string;
  modeName: string;
  snapshotSlug: string | null;
  snapshotNotes: string | null;
  methodology: { slug: string; version: string; name: string | null } | null;
  entries: TierEntry[];
}

export interface WeaponSummary {
  slug: string;
  name: string;
  weaponClass: Enums<"weapon_class">;
  ammo: Enums<"ammo_type">;
  availability: Enums<"availability_kind">;
  description: string | null;
  confidence: Enums<"confidence_level">;
  dataStatus: Enums<"data_status">;
  changeNote: string | null;
}

export interface WeaponDetail extends WeaponSummary {
  fireModes: string[];
  notes: string | null;
  sourceName: string | null;
  tiers: Array<{
    modeSlug: string;
    tier: Enums<"tier_letter">;
    score: number | null;
    breakdown: ScoreLine[];
    confidence: Enums<"confidence_level">;
    evidenceNote: string | null;
  }>;
  impacts: Array<{
    impact: Enums<"impact_level">;
    note: string | null;
  }>;
  attachments: Array<{
    slug: string;
    name: string;
    slot: Enums<"attachment_slot">;
    effects: Array<{ key: string; direction: string; magnitude: string }>;
  }>;
}

export interface ModeOption {
  slug: string;
  name: string;
  aimAssistAllowed: boolean | null;
}

export interface MetaStore {
  provenance: Provenance;
  getVersionIntel(): Promise<VersionIntel>;
  listTierModes(): Promise<ModeOption[]>;
  getTierBoard(modeSlug: string): Promise<TierBoard | null>;
  listWeapons(): Promise<WeaponSummary[]>;
  getWeaponDetail(slug: string): Promise<WeaponDetail | null>;
}

export async function getMetaStore(): Promise<MetaStore> {
  if (authMode() === "supabase") {
    const { SupabaseMetaStore } = await import("./meta-store.supabase");
    return new SupabaseMetaStore();
  }
  const { BundledMetaStore } = await import("./meta-store.bundled");
  return new BundledMetaStore();
}
