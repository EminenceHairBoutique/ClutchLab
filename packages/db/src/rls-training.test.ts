import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { harnessAvailable, startTestDb, type TestDb } from "./test-harness";

/** Phase 4 training schema: catalog visibility + session/result ownership. */

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

describe.runIf(available)("training RLS + seed integrity", () => {
  let db: TestDb;
  let alice: string;
  let bob: string;

  beforeAll(async () => {
    db = await startTestDb();
    alice = await db.createUser("train-alice@example.com");
    bob = await db.createUser("train-bob@example.com");
    await db.grantRole(alice, "player");
    await db.grantRole(bob, "player");
  });

  afterAll(async () => {
    await db?.stop();
  });

  it("exposes 40+ drills, 10+ plans, and skills to anonymous visitors", async () => {
    const drills = await db.asAnon((tx) => tx`select slug from public.drills`);
    expect(drills.length).toBeGreaterThanOrEqual(40);
    const plans = await db.asAnon((tx) => tx`select slug from public.training_plans`);
    expect(plans.length).toBeGreaterThanOrEqual(10);
    const skills = await db.asAnon((tx) => tx`select slug from public.skills`);
    expect(skills.length).toBeGreaterThanOrEqual(20);
  });

  it("seed integrity: WoW directory entries carry no map codes", async () => {
    const rows = await db.sql`select count(*)::int as n from public.wow_maps where map_code is not null`;
    expect(rows[0]?.n).toBe(0);
  });

  it("plan items reference drills and stay within their plan budget", async () => {
    const overBudget = await db.sql`
      select p.slug from public.training_plans p
      join public.training_plan_items i on i.plan_slug = p.slug
      group by p.slug, p.minutes
      having sum(i.minutes) > p.minutes`;
    expect(overBudget).toHaveLength(0);
  });

  it("keeps training sessions and results owner-scoped", async () => {
    await db.asUser(alice, async (tx) => {
      const session = await tx`insert into public.user_training_sessions
        (user_id, title, minutes_planned, drill_slugs, status)
        values (${alice}, 'Morning block', 15, '{first_ten_reddot,full_mag_reddot}', 'completed')
        returning id`;
      await tx`insert into public.drill_results (user_id, session_id, drill_slug, passed, self_rating)
               values (${alice}, ${session[0]?.id as string}, 'first_ten_reddot', true, 4)`;
    });
    const bobSessions = await db.asUser(bob, (tx) => tx`select id from public.user_training_sessions`);
    expect(bobSessions).toHaveLength(0);
    const bobResults = await db.asUser(bob, (tx) => tx`select id from public.drill_results`);
    expect(bobResults).toHaveLength(0);
    await expectPgErrorCode(
      db.asUser(bob, (tx) =>
        tx`insert into public.drill_results (user_id, drill_slug, passed) values (${alice}, 'first_ten_reddot', true)`,
      ),
      "42501",
    );
  });

  it("players cannot edit the drill catalog", async () => {
    await expectPgErrorCode(
      db.asUser(alice, (tx) =>
        tx`update public.drills set passing_score = 'free wins' where slug = 'first_ten_reddot'`,
      ),
      "42501",
    );
  });
});
