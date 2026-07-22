import {
  CONTENT_BASELINE,
  DRILLS,
  GAME_VERSION_45,
  SKILLS,
  TRAINING_PLANS,
  computeBaselineTiers,
  type BaselineTierRow,
  type DrillRecord,
  type SkillRecord,
} from "@clutchlab/content";

/**
 * Pure content selectors for the mobile reader screens. The bundled catalog is
 * identical to the database seed (same source), which also makes every reader
 * screen fully offline-capable by construction. No react / react-native
 * imports here — these run under plain node in tests.
 */

export interface VersionSummary {
  version: string;
  headline: string;
  releasedOn: string | null;
  dataStatus: string;
  confidence: string;
  sourceName: string | null;
}

export function versionSummary(): VersionSummary {
  return {
    version: GAME_VERSION_45.version,
    headline: GAME_VERSION_45.headline ?? "No headline recorded for this version yet.",
    releasedOn: GAME_VERSION_45.releasedOn,
    dataStatus: GAME_VERSION_45.dataStatus,
    confidence: GAME_VERSION_45.confidence,
    sourceName: GAME_VERSION_45.sourceName ?? null,
  };
}

export const MODE_LABELS: Record<string, string> = {
  classic_ranked: "Classic Ranked",
  ultimate_royale: "Ultimate Royale",
};

export interface TierListEntry {
  slug: string;
  name: string;
  weaponClass: string;
  tier: "S" | "A" | "B" | "C" | "D" | "F";
  score: number;
  changeNote: string | null;
}

/** Tier rows for one mode, best first — computed by the same versioned engine as the web/seed. */
export function tierList(modeSlug: string): TierListEntry[] {
  return computeBaselineTiers()
    .filter((row: BaselineTierRow) => row.result.modeSlug === modeSlug)
    .sort((a, b) => b.result.score - a.result.score)
    .map((row) => ({
      slug: row.weapon.slug,
      name: row.weapon.name,
      weaponClass: row.weapon.class.toUpperCase(),
      tier: row.result.tier,
      score: row.result.score,
      changeNote: row.weapon.changeNote,
    }));
}

export function snapshotMeta(): { slug: string; methodologyVersion: string } {
  return {
    slug: CONTENT_BASELINE.snapshotSlug,
    methodologyVersion: CONTENT_BASELINE.methodology.version,
  };
}

export interface SkillGroup {
  skill: SkillRecord;
  drills: DrillRecord[];
}

/** Drills grouped by skill, keeping the catalog's sort order. */
export function drillsBySkill(): SkillGroup[] {
  const bySkill = new Map<string, DrillRecord[]>();
  for (const drill of DRILLS) {
    const list = bySkill.get(drill.skillSlug) ?? [];
    list.push(drill);
    bySkill.set(drill.skillSlug, list);
  }
  return [...SKILLS]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((skill) => ({ skill, drills: bySkill.get(skill.slug) ?? [] }))
    .filter((group) => group.drills.length > 0);
}

export function planList() {
  return TRAINING_PLANS.map((plan) => ({
    slug: plan.slug,
    name: plan.name,
    description: plan.description,
    minutes: plan.minutes,
    drillCount: plan.items.length,
  }));
}
