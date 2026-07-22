import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { harnessAvailable, startTestDb, type TestDb } from "./test-harness";

/** §5.18: opt-in preferences, server-written inbox, per-device push subs. */

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

describe.runIf(available)("notifications RLS", () => {
  let db: TestDb;
  let alice: string;
  let bob: string;

  beforeAll(async () => {
    db = await startTestDb();
    alice = await db.createUser("notif-alice@example.com");
    bob = await db.createUser("notif-bob@example.com");
    await db.grantRole(alice, "player");
    await db.grantRole(bob, "player");
  });

  afterAll(async () => {
    await db?.stop();
  });

  it("lets users manage their own preferences only", async () => {
    await db.asUser(alice, async (tx) => {
      await tx`insert into public.notification_preferences (user_id, kind, enabled)
               values (${alice}, 'coach_response', true)`;
    });
    await expectPgErrorCode(
      db.asUser(bob, (tx) =>
        tx`insert into public.notification_preferences (user_id, kind, enabled)
           values (${alice}, 'weekly_report', true)`,
      ),
      "42501",
    );
    const bobSees = await db.asUser(bob, (tx) =>
      tx`select kind from public.notification_preferences where user_id = ${alice}`,
    );
    expect(bobSees).toHaveLength(0);
  });

  it("blocks users from forging inbox rows; the server writes them", async () => {
    await expectPgErrorCode(
      db.asUser(alice, (tx) =>
        tx`insert into public.notifications (user_id, kind, title, body)
           values (${alice}, 'coach_response', 'Forged', 'self-inserted notification')`,
      ),
      "42501",
    );
    await db.asServiceRole(async (tx) => {
      await tx`insert into public.notifications (user_id, kind, title, body, link_path)
               values (${alice}, 'coach_response', 'Your coaching report is ready',
                       'Open the report to see the three highest-impact mistakes.', '/coach')`;
    });
    const aliceSees = await db.asUser(alice, (tx) =>
      tx`select id, read_at from public.notifications where user_id = ${alice}`,
    );
    expect(aliceSees).toHaveLength(1);
    expect(aliceSees[0]?.read_at).toBeNull();
    const bobSees = await db.asUser(bob, (tx) => tx`select id from public.notifications`);
    expect(bobSees).toHaveLength(0);
  });

  it("lets owners mark their notifications read and delete them", async () => {
    await db.asUser(alice, async (tx) => {
      await tx`update public.notifications set read_at = now() where user_id = ${alice}`;
    });
    const read = await db.sql`select read_at from public.notifications where user_id = ${alice}`;
    expect(read[0]?.read_at).not.toBeNull();

    const deleted = await db.asUser(alice, (tx) =>
      tx`delete from public.notifications where user_id = ${alice} returning id`,
    );
    expect(deleted).toHaveLength(1);
  });

  it("scopes push subscriptions to their owner with unique endpoints", async () => {
    await db.asUser(alice, async (tx) => {
      await tx`insert into public.push_subscriptions (user_id, endpoint, p256dh, auth)
               values (${alice}, 'https://push.example/ep-1', 'key', 'secret')`;
    });
    await expectPgErrorCode(
      db.asUser(bob, (tx) =>
        tx`insert into public.push_subscriptions (user_id, endpoint, p256dh, auth)
           values (${bob}, 'https://push.example/ep-1', 'key', 'secret')`,
      ),
      "23505",
    );
    const bobSees = await db.asUser(bob, (tx) => tx`select id from public.push_subscriptions`);
    expect(bobSees).toHaveLength(0);
    const removed = await db.asUser(alice, (tx) =>
      tx`delete from public.push_subscriptions where endpoint = 'https://push.example/ep-1' returning id`,
    );
    expect(removed).toHaveLength(1);
  });
});
