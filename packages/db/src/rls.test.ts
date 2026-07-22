import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { harnessAvailable, startTestDb, type TestDb } from "./test-harness";

/**
 * RLS integration tests: the real migrations + seed applied to a real Postgres,
 * exercised through the anon/authenticated/service_role roles exactly as
 * Supabase would. Skips loudly when no Postgres is available (see CLAUDE.md).
 */

const available = harnessAvailable();
if (!available) {
  console.warn(
    "\n[RLS TESTS SKIPPED] No local PostgreSQL binaries and no TEST_DATABASE_URL. " +
      "The Phase exit gate requires these tests — run them on a machine with Postgres.\n",
  );
}

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

describe.runIf(available)("row level security", () => {
  let db: TestDb;
  let alice: string;
  let bob: string;
  let editor: string;
  let admin: string;

  beforeAll(async () => {
    db = await startTestDb();
    alice = await db.createUser("alice@example.com");
    bob = await db.createUser("bob@example.com");
    editor = await db.createUser("editor@example.com");
    admin = await db.createUser("admin@example.com");
    await db.grantRole(alice, "player");
    await db.grantRole(bob, "player");
    await db.grantRole(editor, "editor");
    await db.grantRole(admin, "admin");
  });

  afterAll(async () => {
    await db?.stop();
  });

  it("auto-creates a profile when an auth user is created (signup trigger)", async () => {
    const rows = await db.sql`select id from public.profiles where id in (${alice}, ${bob})`;
    expect(rows).toHaveLength(2);
  });

  it("lets a user read only their own profile", async () => {
    const own = await db.asUser(alice, (tx) => tx`select id from public.profiles`);
    expect(own.map((r) => r.id)).toEqual([alice]);
  });

  it("blocks reading another user's profile directly", async () => {
    const rows = await db.asUser(alice, (tx) => tx`select id from public.profiles where id = ${bob}`);
    expect(rows).toHaveLength(0);
  });

  it("lets a user update their own profile but silently filters others", async () => {
    await db.asUser(alice, async (tx) => {
      await tx`update public.profiles set display_name = 'Alice' where id = ${alice}`;
    });
    const updatedOther = await db.asUser(alice, (tx) =>
      tx`update public.profiles set display_name = 'hacked' where id = ${bob} returning id`,
    );
    expect(updatedOther).toHaveLength(0);
    const bobRow = await db.sql`select display_name from public.profiles where id = ${bob}`;
    expect(bobRow[0]?.display_name).toBeNull();
  });

  it("enforces the handle format at the database level", async () => {
    await expectPgErrorCode(
      db.asUser(alice, (tx) => tx`update public.profiles set handle = 'NOT VALID!' where id = ${alice}`),
      "23514",
    );
  });

  it("allows inserting a player profile for yourself but not for someone else", async () => {
    await db.asUser(alice, async (tx) => {
      await tx`insert into public.player_profiles (user_id, finger_count, grip_style)
               values (${alice}, 4, 'claw_4')`;
    });
    await expectPgErrorCode(
      db.asUser(alice, (tx) => tx`insert into public.player_profiles (user_id) values (${bob})`),
      "42501",
    );
  });

  it("exposes the device knowledge base to anonymous visitors", async () => {
    const rows = await db.asAnon((tx) => tx`select model, data_status from public.devices`);
    expect(rows.length).toBeGreaterThanOrEqual(15);
    // Data-integrity rule: nothing in the seed may claim verified status.
    expect(rows.every((r) => r.data_status === "unverified" || r.data_status === "sample")).toBe(
      true,
    );
  });

  it("blocks players from writing to the device knowledge base", async () => {
    await expectPgErrorCode(
      db.asUser(alice, (tx) =>
        tx`insert into public.devices (manufacturer, model, form_factor, os)
           values ('Evil', 'Fake', 'phone', 'android')`,
      ),
      "42501",
    );
  });

  it("lets editors extend the device knowledge base", async () => {
    const inserted = await db.asUser(editor, (tx) =>
      tx`insert into public.devices (manufacturer, model, form_factor, os, data_status)
         values ('TestBrand', 'EditorAdded', 'phone', 'android', 'unverified')
         returning id`,
    );
    expect(inserted).toHaveLength(1);
  });

  it("restricts user_devices to the owner", async () => {
    const device = await db.sql`select id from public.devices limit 1`;
    const deviceId = device[0]?.id as string;
    await db.asUser(alice, async (tx) => {
      await tx`insert into public.user_devices (user_id, device_id, is_primary)
               values (${alice}, ${deviceId}, true)`;
    });
    const visibleToBob = await db.asUser(bob, (tx) => tx`select id from public.user_devices`);
    expect(visibleToBob).toHaveLength(0);
    await expectPgErrorCode(
      db.asUser(bob, (tx) =>
        tx`insert into public.user_devices (user_id, device_id) values (${alice}, ${deviceId})`,
      ),
      "42501",
    );
  });

  it("enforces a single primary device per user", async () => {
    const devices = await db.sql`select id from public.devices order by model limit 2`;
    const secondId = devices[1]?.id as string;
    await expectPgErrorCode(
      db.asUser(alice, (tx) =>
        tx`insert into public.user_devices (user_id, device_id, is_primary)
           values (${alice}, ${secondId}, true)`,
      ),
      "23505",
    );
  });

  it("shows users their own role grants only", async () => {
    const own = await db.asUser(alice, (tx) => tx`select role_slug, user_id from public.user_roles`);
    expect(own).toHaveLength(1);
    expect(own[0]?.user_id).toBe(alice);
  });

  it("prevents self-service role escalation", async () => {
    await expectPgErrorCode(
      db.asUser(alice, (tx) =>
        tx`insert into public.user_roles (user_id, role_slug) values (${alice}, 'admin')`,
      ),
      "42501",
    );
  });

  it("lets admins read all role grants", async () => {
    const all = await db.asUser(admin, (tx) => tx`select user_id from public.user_roles`);
    expect(all.length).toBeGreaterThanOrEqual(4);
  });

  it("keeps subscriptions owner-readable and server-writable only", async () => {
    await db.sql`insert into public.subscriptions (user_id, plan) values (${alice}, 'pro')`;
    const own = await db.asUser(alice, (tx) => tx`select plan from public.subscriptions`);
    expect(own).toHaveLength(1);
    expect(own[0]?.plan).toBe("pro");
    const bobSees = await db.asUser(bob, (tx) => tx`select plan from public.subscriptions`);
    expect(bobSees).toHaveLength(0);
    const clientUpgrade = await db.asUser(alice, (tx) =>
      tx`update public.subscriptions set plan = 'elite' where user_id = ${alice} returning id`,
    );
    expect(clientUpgrade).toHaveLength(0);
  });

  it("hides audit logs from regular users and shows them to admins", async () => {
    await db.sql`insert into public.audit_logs (actor_id, action, entity_type)
                 values (${admin}, 'test.entry', 'test')`;
    const aliceSees = await db.asUser(alice, (tx) => tx`select id from public.audit_logs`);
    expect(aliceSees).toHaveLength(0);
    await expectPgErrorCode(
      db.asUser(alice, (tx) =>
        tx`insert into public.audit_logs (action, entity_type) values ('sneaky', 'test')`,
      ),
      "42501",
    );
    const adminSees = await db.asUser(admin, (tx) => tx`select id from public.audit_logs`);
    expect(adminSees.length).toBeGreaterThanOrEqual(1);
  });

  it("returns nothing for anonymous reads of user-owned tables", async () => {
    const profiles = await db.asAnon((tx) => tx`select id from public.profiles`);
    expect(profiles).toHaveLength(0);
  });

  it("lets service_role bypass RLS (server-side only, as on Supabase)", async () => {
    const rows = await db.asServiceRole((tx) => tx`select id from public.profiles`);
    expect(rows.length).toBeGreaterThanOrEqual(4);
  });

  it("evaluates has_role_at_least through the role rank ladder", async () => {
    const asEditor = await db.asUser(editor, (tx) =>
      tx`select public.has_role_at_least('editor') as ok, public.is_admin() as adm`,
    );
    expect(asEditor[0]?.ok).toBe(true);
    expect(asEditor[0]?.adm).toBe(false);
    const asAdmin = await db.asUser(admin, (tx) => tx`select public.is_admin() as adm`);
    expect(asAdmin[0]?.adm).toBe(true);
  });
});
