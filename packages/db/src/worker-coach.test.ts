import {
  CoachPipelineError,
  MockCoachProvider,
  drainQueue,
  processNextJob,
  requeueStaleJobs,
  type CoachProvider,
} from "@clutchlab/coach";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { harnessAvailable, startTestDb, type TestDb } from "./test-harness";

/**
 * Phase 7: the background worker against the real schema — claim, two-pass
 * analysis, artifact persistence, retry bookkeeping, idempotent rewrites.
 * The worker connects with service-role semantics; here that is the harness
 * superuser connection.
 */

const available = harnessAvailable();

describe.runIf(available)("coach worker", () => {
  let db: TestDb;
  let user: string;

  beforeAll(async () => {
    db = await startTestDb();
    user = await db.createUser("worker-user@example.com");
    await db.grantRole(user, "player");
  });

  afterAll(async () => {
    await db?.stop();
  });

  async function registerAndQueue(label: string): Promise<{ uploadId: string; jobId: string }> {
    return db.asUser(user, async (tx) => {
      const uploads = await tx`insert into public.video_uploads (user_id, kind, label, duration_seconds)
                               values (${user}, 'clip', ${label}, 120) returning id`;
      const uploadId = uploads[0]?.id as string;
      const jobs = await tx`insert into public.analysis_jobs (upload_id, user_id, idempotency_key)
                            values (${uploadId}, ${user}, ${`analyze:${uploadId}`}) returning id`;
      return { uploadId, jobId: jobs[0]?.id as string };
    });
  }

  it("processes a queued job end to end with persisted provenance", async () => {
    // Opt in to §5.18 coach notifications so the worker's insert is observable.
    await db.asUser(user, async (tx) => {
      await tx`insert into public.notification_preferences (user_id, kind, enabled)
               values (${user}, 'coach_response', true)`;
    });
    const { uploadId, jobId } = await registerAndQueue("Worker happy path clip");
    const outcome = await processNextJob({ sql: db.sql, provider: new MockCoachProvider() });
    expect(outcome).toBe("succeeded");

    const job = await db.sql`select status, attempts, error, finished_at
                             from public.analysis_jobs where id = ${jobId}`;
    expect(job[0]?.status).toBe("succeeded");
    expect(job[0]?.attempts).toBe(1);
    expect(job[0]?.error).toBeNull();
    expect(job[0]?.finished_at).not.toBeNull();

    const upload = await db.sql`select status from public.video_uploads where id = ${uploadId}`;
    expect(upload[0]?.status).toBe("complete");

    const observations = await db.sql`select observation, confidence from public.video_observations
                                      where job_id = ${jobId}`;
    expect(observations.length).toBeGreaterThanOrEqual(3);
    expect(observations[0]?.observation).toContain("[MOCK]");

    const reports = await db.sql`select id, model_id, prompt_version, confidence, review_status
                                 from public.coaching_reports where job_id = ${jobId}`;
    expect(reports).toHaveLength(1);
    expect(reports[0]?.model_id).toBe("mock-coach");
    expect(reports[0]?.prompt_version).toBe("coach-v1");
    expect(reports[0]?.review_status).toBe("pending_review");

    const recommendations = await db.sql`select drill_slug from public.coaching_recommendations
                                         where report_id = ${reports[0]?.id as string}`;
    expect(recommendations.length).toBeGreaterThan(0);

    // Opt-in preference was enabled → the worker delivered the inbox row.
    const inbox = await db.sql`select kind, link_path from public.notifications
                               where user_id = ${user}`;
    expect(inbox).toHaveLength(1);
    expect(inbox[0]?.kind).toBe("coach_response");
    expect(inbox[0]?.link_path).toBe(`/coach/reports/${reports[0]?.id as string}`);
  });

  it("reprocessing a requeued job rewrites artifacts without duplication", async () => {
    const { jobId } = await registerAndQueue("Worker idempotency clip");
    expect(await processNextJob({ sql: db.sql, provider: new MockCoachProvider() })).toBe(
      "succeeded",
    );
    const firstCount = await db.sql`select count(*)::int as n from public.video_observations
                                    where job_id = ${jobId}`;

    // Simulate a redelivery: the job lands back in the queue after a crash.
    await db.sql`update public.analysis_jobs set status = 'queued' where id = ${jobId}`;
    expect(await processNextJob({ sql: db.sql, provider: new MockCoachProvider() })).toBe(
      "succeeded",
    );

    const secondCount = await db.sql`select count(*)::int as n from public.video_observations
                                     where job_id = ${jobId}`;
    expect(secondCount[0]?.n).toBe(firstCount[0]?.n);
    const reports = await db.sql`select count(*)::int as n from public.coaching_reports
                                 where job_id = ${jobId}`;
    expect(reports[0]?.n).toBe(1);
  });

  it("marks jobs failed without retry on non-retryable pipeline errors", async () => {
    const { uploadId, jobId } = await registerAndQueue("Worker failure clip");
    const emptyProvider: CoachProvider = {
      modelId: "empty-model",
      promptVersion: "test-v1",
      extractObservations: async () => [],
      synthesizeReport: async () => {
        throw new CoachPipelineError("unreachable", "report");
      },
    };
    const outcome = await processNextJob({ sql: db.sql, provider: emptyProvider });
    expect(outcome).toBe("failed");
    const job = await db.sql`select status, error from public.analysis_jobs where id = ${jobId}`;
    expect(job[0]?.status).toBe("failed");
    expect(String(job[0]?.error)).toMatch(/no observations/i);
    const upload = await db.sql`select status from public.video_uploads where id = ${uploadId}`;
    expect(upload[0]?.status).toBe("failed");
  });

  it("requeues retryable provider failures until the attempt budget runs out", async () => {
    const { jobId } = await registerAndQueue("Worker retry clip");
    const flakyProvider: CoachProvider = {
      modelId: "flaky-model",
      promptVersion: "test-v1",
      extractObservations: async () => {
        throw new Error("connection reset by peer");
      },
      synthesizeReport: async () => {
        throw new Error("unreachable");
      },
    };
    expect(await processNextJob({ sql: db.sql, provider: flakyProvider })).toBe("requeued");
    const afterFirst = await db.sql`select status, attempts from public.analysis_jobs
                                    where id = ${jobId}`;
    expect(afterFirst[0]?.status).toBe("queued");
    expect(afterFirst[0]?.attempts).toBe(1);

    // Drain the remaining budget; the final attempt must land on failed.
    const summary = await drainQueue({ sql: db.sql, provider: flakyProvider });
    expect(summary.failed).toBe(1);
    const finished = await db.sql`select status, attempts from public.analysis_jobs
                                  where id = ${jobId}`;
    expect(finished[0]?.status).toBe("failed");
    expect(finished[0]?.attempts).toBe(5);
  });

  it("returns abandoned running jobs to the queue", async () => {
    const { jobId } = await registerAndQueue("Worker stale clip");
    await db.sql`update public.analysis_jobs
                 set status = 'running', started_at = now() - interval '1 hour'
                 where id = ${jobId}`;
    const requeued = await requeueStaleJobs(db.sql, 15);
    expect(requeued).toBe(1);
    expect(await processNextJob({ sql: db.sql, provider: new MockCoachProvider() })).toBe(
      "succeeded",
    );
  });
});
