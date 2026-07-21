import {
  METHODOLOGY,
  MODE_CONTEXTS,
  computeTier,
  contextForMode,
  type TierResult,
  type WeaponMetaInput,
} from "@clutchlab/meta-engine";

import { ATTACHMENTS } from "./catalog/attachments";
import { CLAIMS, REVIEW_TASKS } from "./catalog/claims";
import { MAPS } from "./catalog/maps";
import { MODES } from "./catalog/modes";
import { SAMPLE_PROS, SAMPLE_TEAMS } from "./catalog/pros";
import { SETTING_EXPLAINERS } from "./catalog/settings";
import { SOURCES } from "./catalog/sources";
import { GAME_VERSION_45, PATCH_45, SEASONS } from "./catalog/versions";
import { TIERABLE_WEAPONS, WEAPONS } from "./catalog/weapons";
import type { WeaponRecord } from "./schemas";

/**
 * The 4.5/S31 editorial baseline snapshot: tiers computed through the
 * meta-engine so the seeded numbers and the app's live math can never diverge.
 */

export const SNAPSHOT_SLUG = "4-5-s31-editorial-baseline";

/** Modes ranked in the baseline. Arena tiers deferred until researched separately. */
export const SNAPSHOT_MODES = ["classic_ranked", "ultimate_royale"] as const;

export interface BaselineTierRow {
  weapon: WeaponRecord;
  result: TierResult;
}

export function toMetaInput(weapon: WeaponRecord): WeaponMetaInput {
  return {
    slug: weapon.slug,
    components: weapon.components,
    availability: weapon.availability,
    attachmentDependency: weapon.attachmentDependency,
    confidence: weapon.confidence,
    roleFit: {},
  };
}

export function computeBaselineTiers(): BaselineTierRow[] {
  const rows: BaselineTierRow[] = [];
  for (const weapon of TIERABLE_WEAPONS) {
    for (const modeSlug of SNAPSHOT_MODES) {
      rows.push({
        weapon,
        result: computeTier(toMetaInput(weapon), contextForMode(modeSlug), {
          availabilityAdjusted: true,
        }),
      });
    }
  }
  return rows;
}

export const CONTENT_BASELINE = {
  version: GAME_VERSION_45,
  seasons: SEASONS,
  patch: PATCH_45,
  modes: MODES,
  maps: MAPS,
  weapons: WEAPONS,
  tierableWeapons: TIERABLE_WEAPONS,
  attachments: ATTACHMENTS,
  sources: SOURCES,
  claims: CLAIMS,
  reviewTasks: REVIEW_TASKS,
  settingExplainers: SETTING_EXPLAINERS,
  sampleTeams: SAMPLE_TEAMS,
  samplePros: SAMPLE_PROS,
  methodology: METHODOLOGY,
  modeContexts: MODE_CONTEXTS,
  snapshotSlug: SNAPSHOT_SLUG,
  snapshotModes: SNAPSHOT_MODES,
} as const;
