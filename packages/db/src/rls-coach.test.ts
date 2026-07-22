import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { harnessAvailable, startTestDb, type TestDb } from "./test-harness";

/**
 * Phase 7: AI coach pipeline — uploads are private, the worker (service role)
 * owns status transitions and AI artifacts, editors review reports.
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

describe.runIf(available)("coach RLS", () => {
  let db: TestDb;
  let alice: string;
  let bob: string;
  let editor: string;
  let uploadId: string;
  let jobId: string;
  let reportId: string;

  beforeAll(async () => {
    db = await startTestDb();
    alice = await db.createUser("coach-alice@example.com");
    bob = await db.createUser("coach-bob@example.com");
    editor = await db.createUser("coach-editor@example.com");
    await db.grantRole(alice, "player");
    await db.grantRole(bob, "player");
    await db.grantRole(editor, "editor");
  });

  afterAll(async () => {
    await db?.stop();
  });

  it("lets a user register an upload nobody else can see", async () => {
    const inserted = await db.asUser(alice, (tx) =>
      tx`insert into public.video_uploads (user_id, kind, label, duration_seconds)
         values (${alice}, 'clip', 'Ranked TDM clutch attempt', 95)
         returning id`,
    );
    uploadId = inserted[0]?.id as string;
    const bobSees = await db.asUser(bob, (tx) =>
      tx`select id from public.video_uploads where id = ${uploadId}`,
    );
    expect(bobSees).toHaveLength(0);
    const anonSees = await db.asAnon((tx) => tx`select id from public.video_uploads`);
    expect(anonSees).toHaveLength(0);
  });

  it("prevents registering an upload as someone else", async () => {
    await expectPgErrorCode(
      db.asUser(bob, (tx) =>
        tx`insert into public.video_uploads (user_id, kind, label)
           values (${alice}, 'clip', 'impersonated upload')`,
      ),
      "42501",
    );
  });

  it("lets the owner queue a job, but only for their own upload and only as queued", async () => {
    const inserted = await db.asUser(alice, (tx) =>
      tx`insert into public.analysis_jobs (upload_id, user_id, idempotency_key)
         values (${uploadId}, ${alice}, ${`analyze:${uploadId}`})
         returning id, status`,
    );
    jobId = inserted[0]?.id as string;
    expect(inserted[0]?.status).toBe("queued");

    // Bob cannot queue a job against Alice's upload (FK checks bypass RLS,
    // so the policy itself must prove upload ownership).
    const bobUpload = await db.asUser(bob, (tx) =>
      tx`insert into public.video_uploads (user_id, kind, label)
         values (${bob}, 'clip', 'Bob clip') returning id`,
    );
    const bobUploadId = bobUpload[0]?.id as string;
    await expectPgErrorCode(
      db.asUser(bob, (tx) =>
        tx`insert into public.analysis_jobs (upload_id, user_id, idempotency_key)
           values (${uploadId}, ${bob}, 'steal-alice-upload')`,
      ),
      "42501",
    );

    // Nor can anyone insert a job pre-marked as running.
    await expectPgErrorCode(
      db.asUser(bob, (tx) =>
        tx`insert into public.analysis_jobs (upload_id, user_id, idempotency_key, status)
           values (${bobUploadId}, ${bob}, 'pre-running', 'running')`,
      ),
      "42501",
    );
  });

  it("enforces one job per upload and unique idempotency keys", async () => {
    await expectPgErrorCode(
      db.asUser(alice, (tx) =>
        tx`insert into public.analysis_jobs (upload_id, user_id, idempotency_key)
           values (${uploadId}, ${alice}, 'second-attempt')`,
      ),
      "23505",
    );
  });

  it("blocks owners from driving job status; the worker (service role) transitions it", async () => {
    const attempt = await db.asUser(alice, (tx) =>
      tx`update public.analysis_jobs set status = 'succeeded' where id = ${jobId} returning id`,
    );
    expect(attempt).toHaveLength(0); // no update policy -> row filtered, not updated
    const unchanged = await db.sql`select status from public.analysis_jobs where id = ${jobId}`;
    expect(unchanged[0]?.status).toBe("queued");

    await db.asServiceRole(async (tx) => {
      await tx`update public.analysis_jobs
               set status = 'running', started_at = now(), attempts = attempts + 1
               where id = ${jobId}`;
    });
    const running = await db.sql`select status from public.analysis_jobs where id = ${jobId}`;
    expect(running[0]?.status).toBe("running");
  });

  it("lets only the worker write observations, visible only to the job owner", async () => {
    await expectPgErrorCode(
      db.asUser(alice, (tx) =>
        tx`insert into public.video_observations (job_id, t_seconds, category, observation, confidence)
           values (${jobId}, 10, 'recoil', 'self-inserted observation', 'high')`,
      ),
      "42501",
    );
    await db.asServiceRole(async (tx) => {
      await tx`insert into public.video_observations (job_id, t_seconds, category, observation, inference, confidence)
               values (${jobId}, 12, 'crosshair_placement',
                       '[MOCK] Crosshair entered the doorway below chest height.', false, 'unverified')`;
    });
    const aliceSees = await db.asUser(alice, (tx) =>
      tx`select id from public.video_observations where job_id = ${jobId}`,
    );
    expect(aliceSees).toHaveLength(1);
    const bobSees = await db.asUser(bob, (tx) =>
      tx`select id from public.video_observations where job_id = ${jobId}`,
    );
    expect(bobSees).toHaveLength(0);
  });

  it("lets only the worker write reports; owner and editor can read them", async () => {
    await expectPgErrorCode(
      db.asUser(alice, (tx) =>
        tx`insert into public.coaching_reports
             (job_id, user_id, executive_summary, could_not_determine, confidence, model_id, prompt_version)
           values (${jobId}, ${alice}, 'self-written report', 'nothing', 'high', 'fake', 'v0')`,
      ),
      "42501",
    );
    const inserted = await db.asServiceRole((tx) =>
      tx`insert into public.coaching_reports
           (job_id, user_id, executive_summary, mistakes, could_not_determine, confidence, model_id, prompt_version)
         values (${jobId}, ${alice}, '[MOCK] Entry crosshair height is the recurring theme.',
                 '[{"tSeconds": 12, "what": "Entered low"}]'::jsonb,
                 'Hit registration and off-screen audio context.', 'unverified', 'mock-coach', 'coach-v1')
         returning id`,
    );
    reportId = inserted[0]?.id as string;

    const aliceSees = await db.asUser(alice, (tx) =>
      tx`select model_id, prompt_version, review_status from public.coaching_reports where id = ${reportId}`,
    );
    expect(aliceSees[0]?.model_id).toBe("mock-coach");
    expect(aliceSees[0]?.review_status).toBe("pending_review");

    const bobSees = await db.asUser(bob, (tx) =>
      tx`select id from public.coaching_reports where id = ${reportId}`,
    );
    expect(bobSees).toHaveLength(0);

    const editorSees = await db.asUser(editor, (tx) =>
      tx`select id from public.coaching_reports where id = ${reportId}`,
    );
    expect(editorSees).toHaveLength(1);
  });

  it("lets editors review reports but blocks owner self-review", async () => {
    const attempt = await db.asUser(alice, (tx) =>
      tx`update public.coaching_reports set review_status = 'published' where id = ${reportId} returning id`,
    );
    expect(attempt).toHaveLength(0);

    await db.asUser(editor, async (tx) => {
      await tx`update public.coaching_reports
               set review_status = 'published', reviewed_by = ${editor}, reviewed_at = now()
               where id = ${reportId}`;
    });
    const published = await db.sql`select review_status from public.coaching_reports where id = ${reportId}`;
    expect(published[0]?.review_status).toBe("published");
  });

  it("shows recommendations to the owner and editors only", async () => {
    await db.asServiceRole(async (tx) => {
      await tx`insert into public.coaching_recommendations (report_id, drill_slug, reason)
               values (${reportId}, 'peek_timer', 'Exposure discipline was the top mistake.')`;
    });
    const aliceSees = await db.asUser(alice, (tx) =>
      tx`select drill_slug from public.coaching_recommendations where report_id = ${reportId}`,
    );
    expect(aliceSees).toHaveLength(1);
    const bobSees = await db.asUser(bob, (tx) =>
      tx`select id from public.coaching_recommendations where report_id = ${reportId}`,
    );
    expect(bobSees).toHaveLength(0);
  });

  it("deleting the upload cascades away the whole derived pipeline (privacy)", async () => {
    const deleted = await db.asUser(alice, (tx) =>
      tx`delete from public.video_uploads where id = ${uploadId} returning id`,
    );
    expect(deleted).toHaveLength(1);
    const jobs = await db.sql`select id from public.analysis_jobs where id = ${jobId}`;
    expect(jobs).toHaveLength(0);
    const reports = await db.sql`select id from public.coaching_reports where id = ${reportId}`;
    expect(reports).toHaveLength(0);
    const observations = await db.sql`select id from public.video_observations where job_id = ${jobId}`;
    expect(observations).toHaveLength(0);
  });
});
