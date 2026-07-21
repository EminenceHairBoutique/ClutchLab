import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { harnessAvailable, startTestDb, type TestDb } from "./test-harness";

/**
 * Phase 2 content-schema RLS + seed-integrity tests: migration 0002 and the
 * generated seed applied to real Postgres, checked through anon/player/editor.
 */

const available = harnessAvailable();

async function expectPgErrorCode(promise: Promise<unknown>, code: string): Promise<void> {
  let caught: unknown;
  try {
    await promise;
  } catch (error) {
    caught = error;
  }
  expect(caught, `expected a Postgres error with code ${code}`).toBeDefined();
  expect((caught as { code?: string }).code).toBe(code);
}

describe.runIf(available)("content schema RLS + seed integrity", () => {
  let db: TestDb;
  let player: string;
  let editor: string;

  beforeAll(async () => {
    db = await startTestDb();
    player = await db.createUser("content-player@example.com");
    editor = await db.createUser("content-editor@example.com");
    await db.grantRole(player, "player");
    await db.grantRole(editor, "editor");
  });

  afterAll(async () => {
    await db?.stop();
  });

  it("exposes the versioned catalog to anonymous visitors", async () => {
    const weapons = await db.asAnon((tx) => tx`select slug from public.weapons`);
    expect(weapons.length).toBeGreaterThanOrEqual(25);
    const modes = await db.asAnon((tx) => tx`select slug from public.modes`);
    expect(modes.length).toBeGreaterThanOrEqual(7);
    const maps = await db.asAnon((tx) => tx`select slug from public.maps`);
    expect(maps.length).toBeGreaterThanOrEqual(8);
    const versions = await db.asAnon((tx) => tx`select version from public.game_versions`);
    expect(versions.map((v) => v.version)).toContain("4.5");
  });

  it("seed integrity: nothing is data_status='verified' anywhere", async () => {
    const tables = [
      "game_versions", "seasons", "patches", "patch_changes", "modes", "maps",
      "map_versions", "weapons", "weapon_versions", "attachments", "attachment_effects",
      "weapon_tiers", "claims",
    ];
    for (const table of tables) {
      const rows = await db.sql.unsafe(
        `select count(*)::int as n from public.${table} where data_status = 'verified'`,
      );
      expect(rows[0]?.n, `${table} has verified rows in seed`).toBe(0);
    }
  });

  it("seed integrity: no invented numeric weapon stats exist", async () => {
    const rows = await db.sql`select count(*)::int as n from public.weapon_stats`;
    expect(rows[0]?.n).toBe(0);
  });

  it("seed integrity: 4.5 map availability is null (unknown), never guessed", async () => {
    const rows = await db.sql`select count(*)::int as n from public.map_versions where available is not null`;
    expect(rows[0]?.n).toBe(0);
  });

  it("published tiers are visible to anon with their full explainable breakdown", async () => {
    const tiers = await db.asAnon(
      (tx) => tx`select tier, score, components, confidence from public.weapon_tiers
                 where mode_slug = 'classic_ranked'`,
    );
    expect(tiers.length).toBeGreaterThanOrEqual(25);
    const first = tiers[0] as { components: { breakdown?: unknown[] } };
    expect(Array.isArray(first.components.breakdown)).toBe(true);
  });

  it("draft snapshots and their tiers are hidden from non-editors", async () => {
    const draftId = "11111111-1111-4111-8111-111111111111";
    const versionRow = await db.sql`select id from public.game_versions limit 1`;
    const methodologyRow = await db.sql`select id from public.tier_methodologies limit 1`;
    await db.sql`insert into public.meta_snapshots (id, slug, game_version_id, methodology_id, status)
                 values (${draftId}, 'test-draft', ${versionRow[0]?.id as string},
                         ${methodologyRow[0]?.id as string}, 'draft')
                 on conflict (slug) do nothing`;
    await db.sql`insert into public.weapon_tiers (snapshot_id, weapon_slug, mode_slug, tier)
                 values (${draftId}, 'm416', 'classic_ranked', 'S')
                 on conflict do nothing`;

    const anonSnapshots = await db.asAnon(
      (tx) => tx`select slug from public.meta_snapshots where slug = 'test-draft'`,
    );
    expect(anonSnapshots).toHaveLength(0);
    const anonTiers = await db.asAnon(
      (tx) => tx`select id from public.weapon_tiers where snapshot_id = ${draftId}`,
    );
    expect(anonTiers).toHaveLength(0);

    const editorSnapshots = await db.asUser(
      editor,
      (tx) => tx`select slug from public.meta_snapshots where slug = 'test-draft'`,
    );
    expect(editorSnapshots).toHaveLength(1);
  });

  it("players cannot write content; editors can", async () => {
    await expectPgErrorCode(
      db.asUser(player, (tx) =>
        tx`insert into public.weapons (slug, name, class, ammo) values ('hax', 'Hax', 'ar', '556')`,
      ),
      "42501",
    );
    const inserted = await db.asUser(editor, (tx) =>
      tx`insert into public.weapons (slug, name, class, ammo, description, data_status, source_name)
         values ('test_editor_weapon', 'Editor Test', 'other', 'other',
                 'Inserted by RLS test', 'sample', 'RLS test')
         returning slug`,
    );
    expect(inserted).toHaveLength(1);
  });

  it("players cannot delete content even where editors can write", async () => {
    const deleted = await db.asUser(player, (tx) =>
      tx`delete from public.weapons where slug = 'test_editor_weapon' returning slug`,
    );
    expect(deleted).toHaveLength(0);
  });

  it("review tasks are editorial-internal", async () => {
    const playerSees = await db.asUser(player, (tx) => tx`select id from public.review_tasks`);
    expect(playerSees).toHaveLength(0);
    const editorSees = await db.asUser(editor, (tx) => tx`select title from public.review_tasks`);
    expect(editorSees.length).toBeGreaterThanOrEqual(4);
  });

  it("patch impact links exist for the ACE32 retest and SMG reviews", async () => {
    const impacts = await db.asAnon(
      (tx) => tx`select entity_id, impact from public.content_impact_links where entity_type = 'weapon'`,
    );
    const ace = impacts.find((i) => i.entity_id === "ace32");
    expect(ace?.impact).toBe("retest_required");
    expect(impacts.filter((i) => i.impact === "review_recommended").length).toBeGreaterThanOrEqual(5);
  });

  it("claims carry linked evidence from the sources table", async () => {
    const rows = await db.asAnon(
      (tx) => tx`select c.slug, count(e.id)::int as evidence
                 from public.claims c
                 left join public.claim_evidence e on e.claim_id = c.id
                 group by c.slug`,
    );
    expect(rows.length).toBeGreaterThanOrEqual(7);
    for (const row of rows) {
      expect(Number(row.evidence), `${row.slug} has no evidence`).toBeGreaterThanOrEqual(1);
    }
  });

  it("seed is idempotent: re-applying the content seed changes nothing", async () => {
    const before = await db.sql`select count(*)::int as n from public.weapon_tiers`;
    await db.sql.file(`${process.cwd()}/../../supabase/seed_content.sql`);
    const after = await db.sql`select count(*)::int as n from public.weapon_tiers`;
    expect(after[0]?.n).toBe(before[0]?.n);
  });
});
