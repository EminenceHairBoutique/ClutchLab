import { CALIBRATION_STEPS } from "@clutchlab/calibration";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { CONTENT_BASELINE, computeBaselineTiers } from "../src/baseline";
import { stableId, upsert, type SqlValue } from "../src/sql";

/**
 * Emits supabase/seed_content.sql from the typed catalog. Deterministic:
 * regenerating without catalog changes produces an identical file (CI checks).
 *
 *   pnpm --filter @clutchlab/content generate
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const outPath = path.resolve(here, "..", "..", "..", "supabase", "seed_content.sql");

const B = CONTENT_BASELINE;
const src = (name: string | null, url: string | null, date: string | null): SqlValue[] => [
  name,
  url,
  date,
];

const versionId = stableId("game_version", `${B.version.version}-${B.version.editionSlug}`);
const patchId = stableId("patch", B.patch.name);
const methodologyId = stableId("methodology", `${B.methodology.slug}-${B.methodology.version}`);
const snapshotId = stableId("meta_snapshot", B.snapshotSlug);
const seasonId = (slug: string) => stableId("season", slug);
const sourceId = (key: string) => stableId("source", key);
const claimId = (slug: string) => stableId("claim", slug);

const sections: string[] = [];

sections.push(`-- GENERATED FILE — do not edit by hand.
-- Source of truth: packages/content/src/catalog/* (zod-validated, meta-engine scored).
-- Regenerate: pnpm --filter @clutchlab/content generate
-- Idempotent upserts; safe to re-run. Nothing here is data_status='verified'.
`);

sections.push(
  upsert({
    table: "game_editions",
    columns: ["slug", "name"],
    conflictTarget: "slug",
    rows: [
      ["global", "Global"],
      ["kr_jp", "Korea / Japan"],
      ["vn", "Vietnam"],
      ["tw", "Taiwan"],
      ["bgmi", "BGMI (India)"],
    ],
  }),
);

sections.push(
  upsert({
    table: "regions",
    columns: ["slug", "name"],
    conflictTarget: "slug",
    rows: [
      ["global", "Global"],
      ["asia", "Asia"],
      ["sea", "Southeast Asia"],
      ["mena", "Middle East & North Africa"],
      ["europe", "Europe"],
      ["na", "North America"],
      ["sa", "South America"],
    ],
  }),
);

sections.push(
  upsert({
    table: "game_versions",
    columns: [
      "id", "version", "edition_slug", "released_on", "window_end", "headline",
      "data_status", "confidence", "source_name", "source_url", "source_date", "notes",
    ],
    conflictTarget: "id",
    rows: [
      [
        versionId, B.version.version, B.version.editionSlug, B.version.releasedOn,
        B.version.windowEnd, B.version.headline, B.version.dataStatus, B.version.confidence,
        ...src(B.version.sourceName, B.version.sourceUrl, B.version.sourceDate), B.version.notes,
      ],
    ],
  }),
);

sections.push(
  upsert({
    table: "seasons",
    columns: [
      "id", "slug", "kind", "name", "starts_at", "ends_at", "game_version_id", "edition_slug",
      "data_status", "confidence", "source_name", "source_url", "source_date", "notes",
    ],
    conflictTarget: "slug",
    rows: B.seasons.map((s) => [
      seasonId(s.slug), s.slug, s.kind, s.name, s.startsAt, s.endsAt, versionId, s.editionSlug,
      s.dataStatus, s.confidence, ...src(s.sourceName, s.sourceUrl, s.sourceDate), s.notes,
    ]),
  }),
);

sections.push(
  upsert({
    table: "patches",
    columns: [
      "id", "game_version_id", "name", "published_on", "summary",
      "data_status", "source_name", "source_url", "source_date",
    ],
    conflictTarget: "id",
    rows: [
      [
        patchId, versionId, B.patch.name, B.patch.publishedOn, B.patch.summary,
        B.patch.dataStatus, ...src(B.patch.sourceName, B.patch.sourceUrl, B.patch.sourceDate),
      ],
    ],
  }),
);

sections.push(
  upsert({
    table: "patch_changes",
    columns: [
      "id", "patch_id", "change_type", "area", "target_slug", "summary", "detail",
      "data_status", "confidence", "source_name", "source_url", "source_date",
    ],
    conflictTarget: "id",
    rows: B.patch.changes.map((c) => [
      stableId("patch_change", c.key), patchId, c.changeType, c.area, c.targetSlug, c.summary,
      c.detail, c.dataStatus, c.confidence, ...src(c.sourceName, c.sourceUrl, c.sourceDate),
    ]),
  }),
);

const smgSlugs = B.tierableWeapons.filter((w) => w.class === "smg").map((w) => w.slug);
sections.push(
  upsert({
    table: "content_impact_links",
    columns: ["id", "patch_change_id", "entity_type", "entity_id", "impact", "note"],
    conflictTarget: "id",
    rows: [
      [
        stableId("impact", "ace32-recoil"), stableId("patch_change", "ace32-recoil"),
        "weapon", "ace32", "retest_required",
        "Recoil behavior changed in 4.5 — saved spray profiles should be retested.",
      ],
      ...smgSlugs.map((slug): SqlValue[] => [
        stableId("impact", `smg-mobility-${slug}`), stableId("patch_change", "smg-mobility"),
        "weapon", slug, "review_recommended",
        "Class-level SMG mobility change in 4.5 may apply; per-weapon confirmation pending.",
      ]),
    ],
  }),
);

sections.push(
  upsert({
    table: "modes",
    columns: [
      "slug", "name", "description", "aim_assist_allowed", "team_sizes",
      "data_status", "source_name", "source_url", "source_date",
    ],
    conflictTarget: "slug",
    rows: B.modes.map((m) => [
      m.slug, m.name, m.description, m.aimAssistAllowed, m.teamSizes,
      m.dataStatus, ...src(m.sourceName, m.sourceUrl, m.sourceDate),
    ]),
  }),
);

sections.push(
  upsert({
    table: "mode_rules",
    columns: [
      "id", "mode_slug", "rule_key", "rule_value", "note",
      "data_status", "source_name", "source_url", "source_date",
    ],
    conflictTarget: "mode_slug, rule_key",
    updateColumns: ["rule_value", "note", "data_status", "source_name", "source_url", "source_date"],
    rows: B.modes.flatMap((m) =>
      m.rules.map((r): SqlValue[] => [
        stableId("mode_rule", `${m.slug}:${r.key}`), m.slug, r.key, r.value, r.note,
        m.dataStatus, ...src(m.sourceName, m.sourceUrl, m.sourceDate),
      ]),
    ),
  }),
);

sections.push(
  upsert({
    table: "maps",
    columns: [
      "slug", "name", "size_km", "terrain", "description",
      "data_status", "source_name", "source_url", "source_date",
    ],
    conflictTarget: "slug",
    rows: B.maps.map((m) => [
      m.slug, m.name, m.sizeKm, m.terrain, m.description,
      m.dataStatus, ...src(m.sourceName, m.sourceUrl, m.sourceDate),
    ]),
  }),
);

sections.push(
  upsert({
    table: "map_versions",
    columns: [
      "id", "map_slug", "game_version_id", "available", "modes", "note",
      "data_status", "source_name", "source_url", "source_date",
    ],
    conflictTarget: "map_slug, game_version_id",
    updateColumns: ["available", "modes", "note", "data_status", "source_name", "source_url", "source_date"],
    rows: B.maps.map((m): SqlValue[] => [
      stableId("map_version", `${m.slug}:${B.version.version}`), m.slug, versionId,
      m.availableInSeedVersion, [], m.availabilityNote,
      m.dataStatus, ...src(m.sourceName, m.sourceUrl, m.sourceDate),
    ]),
  }),
);

sections.push(
  upsert({
    table: "weapons",
    columns: [
      "slug", "name", "class", "ammo", "availability", "fire_modes", "description",
      "data_status", "confidence", "source_name", "source_url", "source_date", "notes",
    ],
    conflictTarget: "slug",
    rows: B.weapons.map((w) => [
      w.slug, w.name, w.class, w.ammo, w.availability, w.fireModes, w.description,
      w.dataStatus, w.confidence, ...src(w.sourceName, w.sourceUrl, w.sourceDate), w.notes,
    ]),
  }),
);

sections.push(
  upsert({
    table: "weapon_versions",
    columns: [
      "id", "weapon_slug", "game_version_id", "change_note",
      "data_status", "source_name", "source_url", "source_date",
    ],
    conflictTarget: "weapon_slug, game_version_id",
    updateColumns: ["change_note", "data_status", "source_name", "source_url", "source_date"],
    rows: B.weapons
      .filter((w) => w.changeNote !== null)
      .map((w): SqlValue[] => [
        stableId("weapon_version", `${w.slug}:${B.version.version}`), w.slug, versionId,
        w.changeNote, w.dataStatus, ...src(w.sourceName, w.sourceUrl, w.sourceDate),
      ]),
  }),
);

sections.push(
  upsert({
    table: "attachments",
    columns: [
      "slug", "name", "slot", "compatible_classes", "description",
      "data_status", "source_name", "source_url", "source_date",
    ],
    conflictTarget: "slug",
    rows: B.attachments.map((a) => [
      a.slug, a.name, a.slot, a.compatibleClasses, a.description,
      a.dataStatus, ...src(a.sourceName, a.sourceUrl, a.sourceDate),
    ]),
  }),
);

sections.push(
  upsert({
    table: "attachment_effects",
    columns: [
      "id", "attachment_slug", "effect_key", "direction", "magnitude", "note",
      "data_status", "source_name", "source_url", "source_date",
    ],
    conflictTarget: "attachment_slug, effect_key",
    updateColumns: ["direction", "magnitude", "note", "data_status", "source_name", "source_url", "source_date"],
    rows: B.attachments.flatMap((a) =>
      a.effects.map((e): SqlValue[] => [
        stableId("attachment_effect", `${a.slug}:${e.key}`), a.slug, e.key, e.direction,
        e.magnitude, e.note, a.dataStatus, ...src(a.sourceName, a.sourceUrl, a.sourceDate),
      ]),
    ),
  }),
);

sections.push(
  upsert({
    table: "tier_methodologies",
    columns: ["id", "slug", "name", "version", "description", "weights"],
    conflictTarget: "slug",
    updateColumns: ["name", "version", "description", "weights"],
    rows: [
      [
        methodologyId, B.methodology.slug, B.methodology.name, B.methodology.version,
        B.methodology.description, B.modeContexts as unknown as Record<string, unknown>,
      ],
    ],
  }),
);

sections.push(
  upsert({
    table: "meta_snapshots",
    columns: [
      "id", "slug", "game_version_id", "season_id", "methodology_id", "status", "published_at", "notes",
    ],
    conflictTarget: "slug",
    updateColumns: ["game_version_id", "season_id", "methodology_id", "status", "published_at", "notes"],
    rows: [
      [
        snapshotId, B.snapshotSlug, versionId, seasonId("s31-classic"), methodologyId,
        "published", "2026-07-21T00:00:00Z",
        "Editorial baseline for 4.5/S31. Component inputs are editorial estimates (low confidence); " +
          "arena tiers deferred pending mode-specific research. See DATA_VERIFICATION.md.",
      ],
    ],
  }),
);

const tierRows = computeBaselineTiers();
const difficultyFor = (recoil: number) => (recoil < 40 ? "easy" : recoil < 65 ? "moderate" : "hard");

sections.push(
  upsert({
    table: "weapon_tiers",
    columns: [
      "id", "snapshot_id", "weapon_slug", "mode_slug", "tier", "score", "components",
      "range_profile", "difficulty", "confidence", "evidence_note", "change_note",
      "data_status", "source_name", "source_url", "source_date",
    ],
    conflictTarget: "snapshot_id, weapon_slug, mode_slug",
    updateColumns: [
      "tier", "score", "components", "range_profile", "difficulty", "confidence",
      "evidence_note", "change_note", "data_status", "source_name", "source_url", "source_date",
    ],
    rows: tierRows.map(({ weapon, result }): SqlValue[] => [
      stableId("weapon_tier", `${B.snapshotSlug}:${weapon.slug}:${result.modeSlug}`),
      snapshotId, weapon.slug, result.modeSlug, result.effectiveTier, result.score,
      {
        methodology: result.methodology,
        availabilityAdjusted: result.availabilityAdjusted,
        breakdown: result.breakdown,
      },
      {
        close: weapon.components.closeRange,
        mid: weapon.components.midRange,
        long: weapon.components.longRange,
      },
      difficultyFor(weapon.components.recoilDifficulty), weapon.confidence,
      `Computed by ${result.methodology.slug} v${result.methodology.version} from editorial component estimates.`,
      weapon.changeNote,
      weapon.dataStatus, ...src(weapon.sourceName, weapon.sourceUrl, weapon.sourceDate),
    ]),
  }),
);

sections.push(
  upsert({
    table: "meta_evidence",
    columns: ["id", "weapon_tier_id", "kind", "summary", "url", "data_status"],
    conflictTarget: "id",
    rows: tierRows.flatMap(({ weapon, result }): SqlValue[][] => {
      const tierId = stableId("weapon_tier", `${B.snapshotSlug}:${weapon.slug}:${result.modeSlug}`);
      const rows: SqlValue[][] = [
        [
          stableId("meta_evidence", `${tierId}:editorial`), tierId, "editorial",
          "Editorial component estimates pending verified measurements or pro-usage data.",
          null, weapon.dataStatus,
        ],
      ];
      if (weapon.changeNote) {
        rows.push([
          stableId("meta_evidence", `${tierId}:patch`), tierId, "community",
          weapon.changeNote,
          "https://www.sportsdunia.com/gaming/pubg-mobile-4-4-beta-weapon-balance-changes",
          weapon.dataStatus,
        ]);
      }
      return rows;
    }),
  }),
);

sections.push(
  upsert({
    table: "sources",
    columns: ["id", "name", "url", "source_type", "published_on", "retrieved_on", "reliability", "notes"],
    conflictTarget: "id",
    rows: B.sources.map((s) => [
      sourceId(s.key), s.name, s.url, s.sourceType, s.publishedOn, s.retrievedOn, s.reliability, s.notes,
    ]),
  }),
);

sections.push(
  upsert({
    table: "claims",
    columns: ["id", "slug", "statement", "verdict", "confidence", "game_version_id", "notes", "data_status"],
    conflictTarget: "slug",
    updateColumns: ["statement", "verdict", "confidence", "game_version_id", "notes", "data_status"],
    rows: B.claims.map((c) => [
      claimId(c.slug), c.slug, c.statement, c.verdict, c.confidence, versionId, c.notes, c.dataStatus,
    ]),
  }),
);

sections.push(
  upsert({
    table: "claim_evidence",
    columns: ["id", "claim_id", "source_id", "supports", "note"],
    conflictTarget: "id",
    rows: B.claims.flatMap((c) =>
      c.evidence.map((e): SqlValue[] => [
        stableId("claim_evidence", `${c.slug}:${e.sourceKey}`), claimId(c.slug),
        sourceId(e.sourceKey), e.supports, e.note,
      ]),
    ),
  }),
);

sections.push(
  upsert({
    table: "review_tasks",
    columns: ["id", "title", "detail", "kind", "entity_type", "entity_id", "status", "priority"],
    conflictTarget: "id",
    updateColumns: ["title", "detail", "kind", "entity_type", "entity_id", "priority"],
    rows: B.reviewTasks.map((t) => [
      stableId("review_task", t.key), t.title, t.detail, t.kind, t.entityType, t.entityId, "open", t.priority,
    ]),
  }),
);

// ---------------------------------------------------------------------------
// Phase 3: settings library, calibration test catalog, sample pro vault
// ---------------------------------------------------------------------------

sections.push(
  upsert({
    table: "setting_definitions",
    columns: [
      "slug", "name", "category", "what_it_does", "what_it_does_not", "advantages",
      "disadvantages", "beginner_recommendation", "competitive_recommendation", "mode_notes",
      "device_impact", "retest_after_update", "data_status", "confidence", "source_name",
      "source_url", "source_date",
    ],
    conflictTarget: "slug",
    rows: B.settingExplainers.map((s): SqlValue[] => [
      s.slug, s.name, s.category, s.whatItDoes, s.whatItDoesNot, s.advantages,
      s.disadvantages, s.beginnerRec, s.competitiveRec, s.modeNotes,
      s.deviceImpact, s.retestAfterUpdate, "unverified", "low",
      "ClutchLab editorial baseline (pending verification)", null, "2026-07-21",
    ]),
  }),
);

sections.push(
  upsert({
    table: "sensitivity_tests",
    columns: [
      "slug", "name", "step_order", "instructions", "metric",
      "adjusts_family", "adjusts_scope", "data_status",
    ],
    conflictTarget: "slug",
    rows: CALIBRATION_STEPS.map((step): SqlValue[] => [
      step.slug, step.name, step.order, step.instructions, step.metric,
      step.adjusts?.family ?? null, step.adjusts?.scope ?? null, "unverified",
    ]),
  }),
);

sections.push(
  upsert({
    table: "teams",
    columns: ["slug", "name", "region", "data_status", "source_name"],
    conflictTarget: "slug",
    rows: B.sampleTeams.map((t): SqlValue[] => [
      t.slug, t.name, t.region, "sample", "ClutchLab sample data (fictional)",
    ]),
  }),
);

sections.push(
  upsert({
    table: "pro_profiles",
    columns: [
      "slug", "display_name", "team_slug", "region", "role", "device_label", "fps_tier",
      "finger_count", "grip_style", "gyro_mode", "aim_assist", "preferred_weapons",
      "main_modes", "verification", "game_version_label", "data_status", "confidence",
      "source_name", "notes",
    ],
    conflictTarget: "slug",
    rows: B.samplePros.map((p): SqlValue[] => [
      p.slug, p.displayName, p.teamSlug, p.region, p.role, p.deviceLabel, p.fpsTier,
      p.fingerCount, p.gripStyle, p.gyroMode, p.aimAssist, p.preferredWeapons,
      p.mainModes, "sample", B.version.version, "sample", "unverified",
      "ClutchLab sample data (fictional)", p.notes,
    ]),
  }),
);

sections.push(
  upsert({
    table: "pro_settings",
    columns: ["id", "pro_slug", "family", "scope", "value", "data_status", "source_name"],
    conflictTarget: "id",
    rows: B.samplePros.flatMap((p) =>
      p.values.map((val): SqlValue[] => [
        stableId("pro_setting", `${p.slug}:${val.family}:${val.scope ?? "-"}`),
        p.slug, val.family, val.scope, val.value, "sample",
        "ClutchLab sample data (fictional)",
      ]),
    ),
  }),
);

const sql = sections.filter((s) => s.length > 0).join("\n");
writeFileSync(outPath, sql);
console.info(`wrote ${outPath} (${sql.length.toLocaleString()} bytes)`);
