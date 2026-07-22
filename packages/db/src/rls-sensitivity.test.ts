import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { harnessAvailable, startTestDb, type TestDb } from "./test-harness";

/** Phase 3 schema: sensitivity ownership chains, version immutability, pro vault. */

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

describe.runIf(available)("sensitivity + pro vault RLS", () => {
  let db: TestDb;
  let alice: string;
  let bob: string;
  let editor: string;
  let profileId: string;
  let versionId: string;

  beforeAll(async () => {
    db = await startTestDb();
    alice = await db.createUser("sens-alice@example.com");
    bob = await db.createUser("sens-bob@example.com");
    editor = await db.createUser("sens-editor@example.com");
    await db.grantRole(alice, "player");
    await db.grantRole(bob, "player");
    await db.grantRole(editor, "editor");
  });

  afterAll(async () => {
    await db?.stop();
  });

  it("lets a user create a profile with an immutable version chain", async () => {
    await db.asUser(alice, async (tx) => {
      const profile = await tx`insert into public.sensitivity_profiles (user_id, name)
                               values (${alice}, 'Main') returning id`;
      profileId = profile[0]?.id as string;
      const version = await tx`insert into public.sensitivity_profile_versions (profile_id, version_no, origin)
                               values (${profileId}, 1, 'manual') returning id`;
      versionId = version[0]?.id as string;
      await tx`insert into public.sensitivity_values (version_id, family, scope, value)
               values (${versionId}, 'camera', 'red_dot', 95), (${versionId}, 'ads', 'x3', 42)`;
      await tx`update public.sensitivity_profiles set active_version_id = ${versionId}
               where id = ${profileId}`;
    });
    const values = await db.asUser(alice, (tx) =>
      tx`select value from public.sensitivity_values where version_id = ${versionId}`,
    );
    expect(values).toHaveLength(2);
  });

  it("hides profiles, versions, and values from other users", async () => {
    const profiles = await db.asUser(bob, (tx) => tx`select id from public.sensitivity_profiles`);
    expect(profiles).toHaveLength(0);
    const versions = await db.asUser(bob, (tx) =>
      tx`select id from public.sensitivity_profile_versions where profile_id = ${profileId}`,
    );
    expect(versions).toHaveLength(0);
    const values = await db.asUser(bob, (tx) =>
      tx`select id from public.sensitivity_values where version_id = ${versionId}`,
    );
    expect(values).toHaveLength(0);
  });

  it("blocks cross-user version inserts (ownership via parent profile)", async () => {
    await expectPgErrorCode(
      db.asUser(bob, (tx) =>
        tx`insert into public.sensitivity_profile_versions (profile_id, version_no)
           values (${profileId}, 99)`,
      ),
      "42501",
    );
  });

  it("makes versions immutable even for their owner (rollback = new version)", async () => {
    const updated = await db.asUser(alice, (tx) =>
      tx`update public.sensitivity_profile_versions set note = 'edited' where id = ${versionId}
         returning id`,
    );
    expect(updated).toHaveLength(0);
    const deleted = await db.asUser(alice, (tx) =>
      tx`delete from public.sensitivity_profile_versions where id = ${versionId} returning id`,
    );
    expect(deleted).toHaveLength(0);
  });

  it("rejects out-of-range sensitivity values at the database level", async () => {
    await expectPgErrorCode(
      db.asUser(alice, (tx) =>
        tx`insert into public.sensitivity_values (version_id, family, scope, value)
           values (${versionId}, 'gyro', 'x6', 400)`,
      ),
      "23514",
    );
  });

  it("stores codes verbatim, owner-only", async () => {
    await db.asUser(alice, async (tx) => {
      await tx`insert into public.setting_codes (user_id, profile_id, kind, code, label)
               values (${alice}, ${profileId}, 'sensitivity', '  7233-1231-  raw!! ', 'from stream')`;
    });
    const own = await db.asUser(alice, (tx) => tx`select code from public.setting_codes`);
    expect(own[0]?.code).toBe("  7233-1231-  raw!! ");
    const other = await db.asUser(bob, (tx) => tx`select code from public.setting_codes`);
    expect(other).toHaveLength(0);
  });

  it("keeps the settings library and calibration catalog editor-writable, public-readable", async () => {
    await db.asUser(editor, async (tx) => {
      await tx`insert into public.setting_definitions (slug, name, category, what_it_does, data_status, source_name)
               values ('test_setting', 'Test setting', 'aiming', 'Does test things.', 'sample', 'RLS test')`;
    });
    const anonSees = await db.asAnon(
      (tx) => tx`select slug from public.setting_definitions where slug = 'test_setting'`,
    );
    expect(anonSees).toHaveLength(1);
    await expectPgErrorCode(
      db.asUser(alice, (tx) =>
        tx`insert into public.setting_definitions (slug, name, category, what_it_does)
           values ('hax', 'Hax', 'aiming', 'nope')`,
      ),
      "42501",
    );
  });

  it("pro vault: public read, editor-managed, sample labels enforced by tests", async () => {
    await db.asUser(editor, async (tx) => {
      await tx`insert into public.pro_profiles (slug, display_name, verification, data_status, source_name)
               values ('test-pro', 'Test Pro', 'sample', 'sample', 'RLS test')`;
      await tx`insert into public.pro_settings (pro_slug, family, scope, value, data_status, source_name)
               values ('test-pro', 'camera', 'red_dot', 100, 'sample', 'RLS test')`;
    });
    const anonSees = await db.asAnon(
      (tx) => tx`select display_name, verification from public.pro_profiles where slug = 'test-pro'`,
    );
    expect(anonSees[0]?.verification).toBe("sample");
    await expectPgErrorCode(
      db.asUser(alice, (tx) =>
        tx`insert into public.pro_profiles (slug, display_name) values ('fake-pro', 'Fake')`,
      ),
      "42501",
    );
  });

  it("test results and recommendations are owner-scoped", async () => {
    await db.asUser(editor, async (tx) => {
      await tx`insert into public.sensitivity_tests (slug, name, step_order, instructions, metric)
               values ('test_step', 'Test step', 99, 'Do the thing.', 'accuracy')
               on conflict (slug) do nothing`;
    });
    await db.asUser(alice, async (tx) => {
      const result = await tx`insert into public.sensitivity_test_results (user_id, profile_version_id, test_slug, outcome)
                              values (${alice}, ${versionId}, 'test_step', 'overshoot') returning id`;
      await tx`insert into public.sensitivity_recommendations (user_id, result_id, family, scope, recommendation, rationale)
               values (${alice}, ${result[0]?.id as string}, 'camera', 'red_dot', 'decrease_small',
                       'Overshooting on the 90° turn test suggests slightly lower camera sensitivity.')`;
    });
    const bobSees = await db.asUser(bob, (tx) => tx`select id from public.sensitivity_recommendations`);
    expect(bobSees).toHaveLength(0);
    const aliceSees = await db.asUser(alice, (tx) =>
      tx`select recommendation from public.sensitivity_recommendations`,
    );
    expect(aliceSees[0]?.recommendation).toBe("decrease_small");
  });
});
