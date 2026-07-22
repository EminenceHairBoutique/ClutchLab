import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { harnessAvailable, startTestDb, type TestDb } from "./test-harness";

/**
 * Phase 8: coach marketplace — verified-only directory, participant-only
 * bookings, ledger integrity, review gating, editor-controlled verification.
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

describe.runIf(available)("marketplace RLS", () => {
  let db: TestDb;
  let coach: string;
  let player: string;
  let stranger: string;
  let editor: string;
  let serviceId: string;
  let bookingId: string;

  beforeAll(async () => {
    db = await startTestDb();
    coach = await db.createUser("mk-coach@example.com");
    player = await db.createUser("mk-player@example.com");
    stranger = await db.createUser("mk-stranger@example.com");
    editor = await db.createUser("mk-editor@example.com");
    await db.grantRole(coach, "coach");
    await db.grantRole(player, "player");
    await db.grantRole(stranger, "player");
    await db.grantRole(editor, "editor");
  });

  afterAll(async () => {
    await db?.stop();
  });

  it("keeps unverified coach profiles out of the public directory", async () => {
    await db.asUser(coach, (tx) =>
      tx`insert into public.coach_profiles (user_id, display_name, headline, region, languages, accepting_bookings)
         values (${coach}, 'Sample Drill Sergeant', 'IGL turned coach', 'EU', '{en,de}', true)`,
    );
    const publicSees = await db.asUser(stranger, (tx) =>
      tx`select user_id from public.coach_profiles where user_id = ${coach}`,
    );
    expect(publicSees).toHaveLength(0);
    const ownSees = await db.asUser(coach, (tx) =>
      tx`select verified from public.coach_profiles where user_id = ${coach}`,
    );
    expect(ownSees).toHaveLength(1);
    expect(ownSees[0]?.verified).toBe(false);
  });

  it("blocks self-verification; editors verify credentials", async () => {
    await expectPgErrorCode(
      db.asUser(coach, (tx) =>
        tx`update public.coach_profiles set verified = true where user_id = ${coach}`,
      ),
      "42501",
    );
    await db.asUser(editor, async (tx) => {
      await tx`update public.coach_profiles set verified = true where user_id = ${coach}`;
    });
    const publicSees = await db.asUser(stranger, (tx) =>
      tx`select display_name from public.coach_profiles where user_id = ${coach}`,
    );
    expect(publicSees).toHaveLength(1);
  });

  it("lists only active services of verified coaches publicly", async () => {
    const inserted = await db.asUser(coach, (tx) =>
      tx`insert into public.coach_services (coach_id, kind, title, price_cents, delivery_days)
         values (${coach}, 'clip_review', 'Async clip review with written notes', 1500, 3)
         returning id`,
    );
    serviceId = inserted[0]?.id as string;
    const publicSees = await db.asUser(stranger, (tx) =>
      tx`select id from public.coach_services where id = ${serviceId}`,
    );
    expect(publicSees).toHaveLength(1);

    await db.asUser(coach, (tx) =>
      tx`update public.coach_services set active = false where id = ${serviceId}`,
    );
    const afterDeactivate = await db.asUser(stranger, (tx) =>
      tx`select id from public.coach_services where id = ${serviceId}`,
    );
    expect(afterDeactivate).toHaveLength(0);
    await db.asUser(coach, (tx) =>
      tx`update public.coach_services set active = true where id = ${serviceId}`,
    );
  });

  it("prevents booking your own service and hides bookings from third parties", async () => {
    await expectPgErrorCode(
      db.asUser(coach, (tx) =>
        tx`insert into public.bookings (service_id, coach_id, player_id, note)
           values (${serviceId}, ${coach}, ${coach}, 'booking myself')`,
      ),
      "23514", // check (coach_id <> player_id)
    );

    const inserted = await db.asUser(player, (tx) =>
      tx`insert into public.bookings (service_id, coach_id, player_id, note)
         values (${serviceId}, ${coach}, ${player}, 'Please review my Miramar clutch clip.')
         returning id`,
    );
    bookingId = inserted[0]?.id as string;

    const strangerSees = await db.asUser(stranger, (tx) =>
      tx`select id from public.bookings where id = ${bookingId}`,
    );
    expect(strangerSees).toHaveLength(0);
    const coachSees = await db.asUser(coach, (tx) =>
      tx`select id, status from public.bookings where id = ${bookingId}`,
    );
    expect(coachSees).toHaveLength(1);
  });

  it("blocks bookings against unverified or paused coaches", async () => {
    await db.sql`update public.coach_profiles set accepting_bookings = false where user_id = ${coach}`;
    await expectPgErrorCode(
      db.asUser(stranger, (tx) =>
        tx`insert into public.bookings (service_id, coach_id, player_id)
           values (${serviceId}, ${coach}, ${stranger})`,
      ),
      "42501",
    );
    await db.sql`update public.coach_profiles set accepting_bookings = true where user_id = ${coach}`;
  });

  it("keeps the order ledger participant-readable and server-written", async () => {
    await expectPgErrorCode(
      db.asUser(player, (tx) =>
        tx`insert into public.marketplace_orders
             (booking_id, player_id, coach_id, amount_cents, platform_fee_cents, coach_net_cents)
           values (${bookingId}, ${player}, ${coach}, 1500, 300, 1200)`,
      ),
      "42501",
    );
    await db.asServiceRole(async (tx) => {
      await tx`insert into public.marketplace_orders
                 (booking_id, player_id, coach_id, amount_cents, platform_fee_cents, coach_net_cents, status, paid_at, payout_status)
               values (${bookingId}, ${player}, ${coach}, 1500, 300, 1200, 'paid', now(), 'pending')`;
    });
    const playerSees = await db.asUser(player, (tx) =>
      tx`select amount_cents from public.marketplace_orders where booking_id = ${bookingId}`,
    );
    expect(playerSees).toHaveLength(1);
    const strangerSees = await db.asUser(stranger, (tx) =>
      tx`select id from public.marketplace_orders where booking_id = ${bookingId}`,
    );
    expect(strangerSees).toHaveLength(0);

    // Ledger integrity: fee + net must equal amount.
    await expectPgErrorCode(
      db.asServiceRole((tx) =>
        tx`update public.marketplace_orders set platform_fee_cents = 999999
           where booking_id = ${bookingId}`,
      ),
      "23514",
    );
  });

  it("allows reviews only after completion, only by the booking's player", async () => {
    await expectPgErrorCode(
      db.asUser(player, (tx) =>
        tx`insert into public.coach_reviews (booking_id, coach_id, player_id, rating, body)
           values (${bookingId}, ${coach}, ${player}, 5, 'Too early - booking not complete.')`,
      ),
      "42501",
    );

    await db.asUser(coach, async (tx) => {
      await tx`update public.bookings set status = 'delivered', delivered_at = now(),
               deliverable = 'Written review: entry timing costs you the first knock; drill list attached.'
               where id = ${bookingId}`;
    });
    await db.asUser(player, async (tx) => {
      await tx`update public.bookings set status = 'completed', completed_at = now()
               where id = ${bookingId}`;
    });

    await expectPgErrorCode(
      db.asUser(stranger, (tx) =>
        tx`insert into public.coach_reviews (booking_id, coach_id, player_id, rating)
           values (${bookingId}, ${coach}, ${stranger}, 1)`,
      ),
      "42501",
    );

    await db.asUser(player, async (tx) => {
      await tx`insert into public.coach_reviews (booking_id, coach_id, player_id, rating, body)
               values (${bookingId}, ${coach}, ${player}, 5, 'Clear, specific, and honest about limits.')`;
    });
    const publicSees = await db.asUser(stranger, (tx) =>
      tx`select rating from public.coach_reviews where booking_id = ${bookingId}`,
    );
    expect(publicSees).toHaveLength(1);

    // One review per booking.
    await expectPgErrorCode(
      db.asUser(player, (tx) =>
        tx`insert into public.coach_reviews (booking_id, coach_id, player_id, rating)
           values (${bookingId}, ${coach}, ${player}, 4)`,
      ),
      "23505",
    );
  });

  it("subscriptions carry the cancel flag and stay owner-readable only", async () => {
    await db.asServiceRole(async (tx) => {
      await tx`insert into public.subscriptions (user_id, plan, status, cancel_at_period_end)
               values (${player}, 'pro', 'active', true)
               on conflict (user_id) do update set plan = 'pro', cancel_at_period_end = true`;
    });
    const own = await db.asUser(player, (tx) =>
      tx`select plan, cancel_at_period_end from public.subscriptions where user_id = ${player}`,
    );
    expect(own[0]?.plan).toBe("pro");
    expect(own[0]?.cancel_at_period_end).toBe(true);
    const strangerSees = await db.asUser(stranger, (tx) =>
      tx`select id from public.subscriptions where user_id = ${player}`,
    );
    expect(strangerSees).toHaveLength(0);
  });
});
