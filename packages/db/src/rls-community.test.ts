import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { harnessAvailable, startTestDb, type TestDb } from "./test-harness";

/** Phase 6: community moderation model — visibility, ownership, queues. */

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

describe.runIf(available)("community RLS", () => {
  let db: TestDb;
  let alice: string;
  let bob: string;
  let moderator: string;
  let postId: string;

  beforeAll(async () => {
    db = await startTestDb();
    alice = await db.createUser("comm-alice@example.com");
    bob = await db.createUser("comm-bob@example.com");
    moderator = await db.createUser("comm-mod@example.com");
    await db.grantRole(alice, "player");
    await db.grantRole(bob, "player");
    await db.grantRole(moderator, "moderator");
  });

  afterAll(async () => {
    await db?.stop();
  });

  it("lets users post and everyone read visible posts", async () => {
    const inserted = await db.asUser(alice, (tx) =>
      tx`insert into public.posts (author_id, kind, title, body)
         values (${alice}, 'settings', 'My 3x setup after calibration', 'Went from 40 to 38 after the spray test.')
         returning id`,
    );
    postId = inserted[0]?.id as string;
    const anonSees = await db.asAnon((tx) => tx`select id from public.posts where id = ${postId}`);
    expect(anonSees).toHaveLength(1);
  });

  it("prevents posting as someone else", async () => {
    await expectPgErrorCode(
      db.asUser(bob, (tx) =>
        tx`insert into public.posts (author_id, title, body) values (${alice}, 'Fake', 'impersonation')`,
      ),
      "42501",
    );
  });

  it("hides flagged posts from the public but not from the author or moderators", async () => {
    await db.sql`update public.posts set status = 'flagged', auto_flag_reason = 'test flag'
                 where id = ${postId}`;
    const anonSees = await db.asAnon((tx) => tx`select id from public.posts where id = ${postId}`);
    expect(anonSees).toHaveLength(0);
    const authorSees = await db.asUser(alice, (tx) => tx`select id from public.posts where id = ${postId}`);
    expect(authorSees).toHaveLength(1);
    const modSees = await db.asUser(moderator, (tx) => tx`select id from public.posts where id = ${postId}`);
    expect(modSees).toHaveLength(1);
    await db.sql`update public.posts set status = 'visible', auto_flag_reason = null where id = ${postId}`;
  });

  it("authors cannot self-assign moderation statuses", async () => {
    await expectPgErrorCode(
      db.asUser(alice, (tx) =>
        tx`update public.posts set status = 'removed' where id = ${postId}`,
      ),
      "42501",
    );
  });

  it("comments and reactions follow ownership", async () => {
    await db.asUser(bob, async (tx) => {
      await tx`insert into public.comments (post_id, author_id, body)
               values (${postId}, ${bob}, 'What grip are you on?')`;
      await tx`insert into public.reactions (post_id, user_id, kind)
               values (${postId}, ${bob}, 'tested_it')`;
    });
    await expectPgErrorCode(
      db.asUser(bob, (tx) =>
        tx`insert into public.reactions (post_id, user_id) values (${postId}, ${alice})`,
      ),
      "42501",
    );
  });

  it("reports flow to moderators, not to other users", async () => {
    await db.asUser(bob, async (tx) => {
      await tx`insert into public.reports (reporter_id, entity_type, entity_id, reason, detail)
               values (${bob}, 'post', ${postId}, 'spam', 'testing the queue')`;
    });
    const aliceSees = await db.asUser(alice, (tx) => tx`select id from public.reports`);
    expect(aliceSees).toHaveLength(0);
    const modSees = await db.asUser(moderator, (tx) => tx`select id, status from public.reports`);
    expect(modSees.length).toBeGreaterThanOrEqual(1);
  });

  it("moderators can remove content and record the action; players cannot", async () => {
    await db.asUser(moderator, async (tx) => {
      await tx`update public.posts set status = 'removed' where id = ${postId}`;
      await tx`insert into public.moderation_actions (moderator_id, action, entity_type, entity_id, note)
               values (${moderator}, 'remove_content', 'post', ${postId}, 'RLS test removal')`;
    });
    const anonSees = await db.asAnon((tx) => tx`select id from public.posts where id = ${postId}`);
    expect(anonSees).toHaveLength(0);
    await expectPgErrorCode(
      db.asUser(alice, (tx) =>
        tx`insert into public.moderation_actions (moderator_id, action) values (${alice}, 'note')`,
      ),
      "42501",
    );
  });

  it("correction requests reach editors with requester visibility", async () => {
    await db.asUser(bob, async (tx) => {
      await tx`insert into public.correction_requests (requester_id, pro_slug, claim, source_url)
               values (${bob}, 'sample-novadrift', 'Device label looks outdated per recent stream.',
                       'https://example.com/vod')`;
    });
    const aliceSees = await db.asUser(alice, (tx) => tx`select id from public.correction_requests`);
    expect(aliceSees).toHaveLength(0);
    const bobSees = await db.asUser(bob, (tx) => tx`select id from public.correction_requests`);
    expect(bobSees).toHaveLength(1);
  });
});
