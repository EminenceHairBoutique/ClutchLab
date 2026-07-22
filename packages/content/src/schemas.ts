import {
  attachmentDependencySchema,
  availabilityKindSchema,
  confidenceSchema,
  weaponComponentsSchema,
} from "@clutchlab/meta-engine";
import { z } from "zod";

/**
 * Content-record schemas — the single source of truth feeding both the SQL seed
 * generator and the app's unconfigured-mode reads. Shapes mirror
 * supabase/migrations/20260721000002_content.sql.
 *
 * Data integrity (spec §0.1.8): `data_status` may never be "verified" in this
 * catalog — verification happens through the editorial workflow, not in code.
 */

export const seedDataStatusSchema = z.enum(["unverified", "sample"]);

export const sourceRefSchema = z.object({
  sourceName: z.string().min(3),
  sourceUrl: z.string().url().nullable(),
  sourceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
});

const based = {
  dataStatus: seedDataStatusSchema,
  ...sourceRefSchema.shape,
};

export const gameVersionRecordSchema = z.object({
  version: z.string().min(1),
  editionSlug: z.string().min(2),
  releasedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  windowEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  headline: z.string().nullable(),
  confidence: confidenceSchema,
  notes: z.string().nullable(),
  ...based,
});
export type GameVersionRecord = z.infer<typeof gameVersionRecordSchema>;

export const seasonRecordSchema = z.object({
  slug: z.string().regex(/^[a-z0-9_-]{3,40}$/),
  kind: z.enum(["classic", "casual", "ultimate_royale", "ranked_arena", "metro", "other"]),
  name: z.string().min(3),
  startsAt: z.string().datetime({ offset: true }).nullable(),
  endsAt: z.string().datetime({ offset: true }).nullable(),
  editionSlug: z.string().min(2),
  confidence: confidenceSchema,
  notes: z.string().nullable(),
  ...based,
});
export type SeasonRecord = z.infer<typeof seasonRecordSchema>;

export const patchChangeRecordSchema = z.object({
  key: z.string().min(3),
  changeType: z.enum(["buff", "nerf", "adjustment", "new", "removed", "system"]),
  area: z.enum(["weapon", "attachment", "map", "mode", "movement", "settings", "audio", "other"]),
  targetSlug: z.string().nullable(),
  summary: z.string().min(10),
  detail: z.string().nullable(),
  confidence: confidenceSchema,
  ...based,
});
export type PatchChangeRecord = z.infer<typeof patchChangeRecordSchema>;

export const patchRecordSchema = z.object({
  name: z.string().min(3),
  publishedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  summary: z.string().nullable(),
  changes: z.array(patchChangeRecordSchema).min(1),
  ...based,
});
export type PatchRecord = z.infer<typeof patchRecordSchema>;

export const modeRecordSchema = z.object({
  slug: z.string().regex(/^[a-z0-9_]{2,40}$/),
  name: z.string().min(2),
  description: z.string().min(10),
  aimAssistAllowed: z.boolean().nullable(),
  teamSizes: z.array(z.string()),
  rules: z.array(
    z.object({
      key: z.string().min(2),
      value: z.string().min(1),
      note: z.string().nullable(),
    }),
  ),
  ...based,
});
export type ModeRecord = z.infer<typeof modeRecordSchema>;

export const mapRecordSchema = z.object({
  slug: z.string().regex(/^[a-z0-9_]{2,40}$/),
  name: z.string().min(2),
  sizeKm: z.number().int().min(1).max(10).nullable(),
  terrain: z.string().nullable(),
  description: z.string().nullable(),
  /** Availability in the seeded game version: null = unknown (never guessed). */
  availableInSeedVersion: z.boolean().nullable(),
  availabilityNote: z.string().nullable(),
  ...based,
});
export type MapRecord = z.infer<typeof mapRecordSchema>;

export const weaponRecordSchema = z.object({
  slug: z.string().regex(/^[a-z0-9_]{2,40}$/),
  name: z.string().min(2),
  class: z.enum(["ar", "smg", "dmr", "sr", "lmg", "shotgun", "pistol", "other"]),
  ammo: z.enum(["556", "762", "9mm", "45acp", "12gauge", "300magnum", "bolt", "other"]),
  availability: availabilityKindSchema,
  fireModes: z.array(z.enum(["single", "burst", "auto", "bolt", "pump", "semi"])),
  description: z.string().min(10),
  /** Editorial scoring inputs (0–100) — clearly labeled, low confidence. */
  components: weaponComponentsSchema,
  attachmentDependency: attachmentDependencySchema,
  confidence: confidenceSchema,
  /** 4.5 change note when a verified-enough patch change touches this weapon. */
  changeNote: z.string().nullable(),
  notes: z.string().nullable(),
  ...based,
});
export type WeaponRecord = z.infer<typeof weaponRecordSchema>;

export const attachmentRecordSchema = z.object({
  slug: z.string().regex(/^[a-z0-9_]{2,50}$/),
  name: z.string().min(2),
  slot: z.enum(["muzzle", "grip", "scope", "magazine", "stock", "canted"]),
  compatibleClasses: z.array(z.string()),
  description: z.string().nullable(),
  effects: z.array(
    z.object({
      key: z.string().min(2),
      direction: z.enum(["improves", "worsens", "mixed", "none", "unknown"]),
      magnitude: z.enum(["minor", "moderate", "major", "unknown"]),
      note: z.string().nullable(),
    }),
  ),
  ...based,
});
export type AttachmentRecord = z.infer<typeof attachmentRecordSchema>;

export const sourceRecordSchema = z.object({
  key: z.string().min(2),
  name: z.string().min(3),
  url: z.string().url().nullable(),
  sourceType: z.enum(["official", "press", "news", "creator", "community", "measured", "editorial"]),
  publishedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  retrievedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reliability: z.enum(["high", "medium", "low"]),
  notes: z.string().nullable(),
});
export type SourceRecord = z.infer<typeof sourceRecordSchema>;

export const claimRecordSchema = z.object({
  slug: z.string().regex(/^[a-z0-9_-]{3,80}$/),
  statement: z.string().min(10),
  verdict: z.enum(["supported", "partial", "unsupported", "disputed", "unverified"]),
  confidence: confidenceSchema,
  notes: z.string().nullable(),
  evidence: z.array(
    z.object({
      sourceKey: z.string(),
      supports: z.boolean(),
      note: z.string().nullable(),
    }),
  ),
  dataStatus: seedDataStatusSchema,
});
export type ClaimRecord = z.infer<typeof claimRecordSchema>;

export const reviewTaskRecordSchema = z.object({
  key: z.string().min(3),
  title: z.string().min(5),
  detail: z.string().min(10),
  kind: z.enum(["verify", "update", "investigate"]),
  entityType: z.string().nullable(),
  entityId: z.string().nullable(),
  priority: z.enum(["low", "medium", "high"]),
});
export type ReviewTaskRecord = z.infer<typeof reviewTaskRecordSchema>;
