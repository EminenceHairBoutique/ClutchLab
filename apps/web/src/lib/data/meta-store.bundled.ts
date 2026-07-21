import "server-only";

import { CONTENT_BASELINE, computeBaselineTiers } from "@clutchlab/content";

import type {
  MetaStore,
  ModeOption,
  TierBoard,
  TierEntry,
  VersionIntel,
  WeaponDetail,
  WeaponSummary,
} from "./meta-store";

/**
 * Bundled editorial baseline (NOT a mock): the identical records the SQL seed
 * is generated from, with tiers computed through the same meta-engine call.
 * Active only when Supabase is unconfigured; every page shows the provenance.
 */

const B = CONTENT_BASELINE;
const TIER_ORDER = ["S", "A", "B", "C", "D", "F"] as const;

function tierEntries(modeSlug: string): TierEntry[] {
  return computeBaselineTiers()
    .filter((row) => row.result.modeSlug === modeSlug)
    .map(({ weapon, result }) => ({
      weaponSlug: weapon.slug,
      weaponName: weapon.name,
      weaponClass: weapon.class,
      availability: weapon.availability,
      description: weapon.description,
      tier: result.effectiveTier,
      score: result.score,
      breakdown: result.breakdown,
      rangeProfile: {
        close: weapon.components.closeRange,
        mid: weapon.components.midRange,
        long: weapon.components.longRange,
      },
      difficulty:
        weapon.components.recoilDifficulty < 40
          ? ("easy" as const)
          : weapon.components.recoilDifficulty < 65
            ? ("moderate" as const)
            : ("hard" as const),
      confidence: weapon.confidence,
      evidenceNote: `Computed by ${result.methodology.slug} v${result.methodology.version} from editorial component estimates.`,
      changeNote: weapon.changeNote,
      dataStatus: weapon.dataStatus,
    }))
    .sort(
      (a, b) =>
        TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier) ||
        (b.score ?? 0) - (a.score ?? 0),
    );
}

export class BundledMetaStore implements MetaStore {
  readonly provenance = "bundled-baseline" as const;

  async getVersionIntel(): Promise<VersionIntel> {
    return {
      provenance: this.provenance,
      version: {
        version: B.version.version,
        releasedOn: B.version.releasedOn,
        windowEnd: B.version.windowEnd,
        headline: B.version.headline,
        dataStatus: B.version.dataStatus,
        confidence: B.version.confidence,
        sourceName: B.version.sourceName,
        sourceUrl: B.version.sourceUrl,
      },
      seasons: B.seasons.map((s) => ({
        slug: s.slug,
        name: s.name,
        kind: s.kind,
        startsAt: s.startsAt,
        endsAt: s.endsAt,
        dataStatus: s.dataStatus,
        confidence: s.confidence,
        notes: s.notes,
      })),
      changes: B.patch.changes.map((c) => ({
        summary: c.summary,
        detail: c.detail,
        changeType: c.changeType,
        area: c.area,
        targetSlug: c.targetSlug,
        confidence: c.confidence,
        dataStatus: c.dataStatus,
      })),
    };
  }

  async listTierModes(): Promise<ModeOption[]> {
    return B.modes
      .filter((m) => (B.snapshotModes as readonly string[]).includes(m.slug))
      .map((m) => ({ slug: m.slug, name: m.name, aimAssistAllowed: m.aimAssistAllowed }));
  }

  async getTierBoard(modeSlug: string): Promise<TierBoard | null> {
    const mode = B.modes.find((m) => m.slug === modeSlug);
    if (!mode || !(B.snapshotModes as readonly string[]).includes(modeSlug)) return null;
    return {
      provenance: this.provenance,
      modeSlug,
      modeName: mode.name,
      snapshotSlug: B.snapshotSlug,
      snapshotNotes:
        "Editorial baseline for 4.5/S31. Component inputs are editorial estimates (low confidence).",
      methodology: {
        slug: B.methodology.slug,
        version: B.methodology.version,
        name: B.methodology.name,
      },
      entries: tierEntries(modeSlug),
    };
  }

  async listWeapons(): Promise<WeaponSummary[]> {
    return B.tierableWeapons.map((w) => ({
      slug: w.slug,
      name: w.name,
      weaponClass: w.class,
      ammo: w.ammo,
      availability: w.availability,
      description: w.description,
      confidence: w.confidence,
      dataStatus: w.dataStatus,
      changeNote: w.changeNote,
    }));
  }

  async getWeaponDetail(slug: string): Promise<WeaponDetail | null> {
    const weapon = B.tierableWeapons.find((w) => w.slug === slug);
    if (!weapon) return null;
    const tiers = computeBaselineTiers()
      .filter((row) => row.weapon.slug === slug)
      .map(({ result }) => ({
        modeSlug: result.modeSlug,
        tier: result.effectiveTier,
        score: result.score,
        breakdown: result.breakdown,
        confidence: weapon.confidence,
        evidenceNote: `Computed by ${result.methodology.slug} v${result.methodology.version}.`,
      }));
    const impacts: WeaponDetail["impacts"] = [];
    if (slug === "ace32") {
      impacts.push({
        impact: "retest_required",
        note: "Recoil behavior changed in 4.5 — saved spray profiles should be retested.",
      });
    } else if (weapon.class === "smg") {
      impacts.push({
        impact: "review_recommended",
        note: "Class-level SMG mobility change in 4.5 may apply; per-weapon confirmation pending.",
      });
    }
    return {
      slug: weapon.slug,
      name: weapon.name,
      weaponClass: weapon.class,
      ammo: weapon.ammo,
      availability: weapon.availability,
      description: weapon.description,
      confidence: weapon.confidence,
      dataStatus: weapon.dataStatus,
      changeNote: weapon.changeNote,
      fireModes: weapon.fireModes,
      notes: weapon.notes,
      sourceName: weapon.sourceName,
      tiers,
      impacts,
      attachments: B.attachments
        .filter((a) => a.compatibleClasses.includes(weapon.class))
        .map((a) => ({
          slug: a.slug,
          name: a.name,
          slot: a.slot,
          effects: a.effects.map((e) => ({
            key: e.key,
            direction: e.direction,
            magnitude: e.magnitude,
          })),
        })),
    };
  }
}
