import type postgres from "postgres";

import { CoachPipelineError, runAnalysis } from "./pipeline";
import { CoachProviderError } from "./provider.anthropic";
import { UPLOAD_KINDS, type CoachContext, type CoachProvider, type UploadKind } from "./types";

/**
 * Background analysis worker (spec §5.13.2): processes queued analysis_jobs.
 * NEVER runs inside a request handler. Connects with service-role semantics
 * (direct DATABASE_URL / service key), so RLS does not apply — every write
 * here is the worker's responsibility.
 *
 * Idempotency: a crashed/retried job rewrites its artifacts atomically
 * (delete + insert inside one transaction keyed by job_id).
 */

export const MAX_ATTEMPTS = 5;

export interface WorkerDeps {
  sql: postgres.Sql;
  provider: CoachProvider;
  /**
   * Keyframe extraction hook (ffmpeg in production). Absent or returning []
   * means metadata-only analysis — providers must then refuse to fabricate.
   */
  extractFrames?: (upload: ClaimedUpload) => Promise<string[]>;
  log?: (line: string) => void;
}

export interface ClaimedUpload {
  id: string;
  kind: UploadKind;
  label: string;
  durationSeconds: number | null;
  storagePath: string | null;
}

interface ClaimedJob {
  id: string;
  uploadId: string;
  userId: string;
  attempts: number;
}

function toUploadKind(value: string): UploadKind {
  const kind = UPLOAD_KINDS.find((k) => k === value);
  if (!kind) throw new Error(`unknown upload kind in database: ${value}`);
  return kind;
}

/** Claim the oldest queued job (skip-locked so parallel workers never collide). */
async function claimJob(sql: postgres.Sql): Promise<ClaimedJob | null> {
  const rows = await sql`
    update public.analysis_jobs
    set status = 'running', started_at = now(), attempts = attempts + 1
    where id = (
      select id from public.analysis_jobs
      where status = 'queued' and attempts < ${MAX_ATTEMPTS}
      order by created_at
      limit 1
      for update skip locked
    )
    returning id, upload_id, user_id, attempts`;
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id as string,
    uploadId: row.upload_id as string,
    userId: row.user_id as string,
    attempts: row.attempts as number,
  };
}

async function loadUpload(sql: postgres.Sql, uploadId: string): Promise<ClaimedUpload> {
  const rows = await sql`
    select id, kind, label, duration_seconds, storage_path
    from public.video_uploads where id = ${uploadId}`;
  const row = rows[0];
  if (!row) throw new Error(`upload ${uploadId} vanished mid-job`);
  return {
    id: row.id as string,
    kind: toUploadKind(row.kind as string),
    label: row.label as string,
    durationSeconds: row.duration_seconds as number | null,
    storagePath: row.storage_path as string | null,
  };
}

export type JobOutcome = "empty" | "succeeded" | "requeued" | "failed";

export async function processNextJob(deps: WorkerDeps): Promise<JobOutcome> {
  const { sql, provider } = deps;
  const log = deps.log ?? (() => {});

  const job = await claimJob(sql);
  if (!job) return "empty";
  log(`job ${job.id}: claimed (attempt ${job.attempts}/${MAX_ATTEMPTS})`);

  try {
    const upload = await loadUpload(sql, job.uploadId);
    await sql`update public.video_uploads set status = 'processing' where id = ${upload.id}`;

    const frames = deps.extractFrames ? await deps.extractFrames(upload) : [];
    const context: CoachContext = {
      uploadKind: upload.kind,
      label: upload.label,
      durationSeconds: upload.durationSeconds,
      frames,
    };

    const result = await runAnalysis(provider, context);
    if (result.unknownDrillSlugs.length > 0) {
      log(`job ${job.id}: dropped unknown drill slugs ${result.unknownDrillSlugs.join(", ")}`);
    }

    await sql.begin(async (tx) => {
      // Idempotent rewrite: clear artifacts from any earlier attempt.
      await tx`delete from public.coaching_reports where job_id = ${job.id}`;
      await tx`delete from public.video_observations where job_id = ${job.id}`;
      for (const o of result.observations) {
        await tx`insert into public.video_observations
                   (job_id, t_seconds, category, observation, inference, confidence)
                 values (${job.id}, ${o.tSeconds}, ${o.category}, ${o.observation},
                         ${o.inference}, ${o.confidence})`;
      }
      const reportRows = await tx`insert into public.coaching_reports
          (job_id, user_id, executive_summary, mistakes, settings_note, could_not_determine,
           confidence, model_id, prompt_version)
        values (${job.id}, ${job.userId}, ${result.draft.executiveSummary},
                ${tx.json(result.draft.mistakes)}, ${result.draft.settingsNote},
                ${result.draft.couldNotDetermine}, ${result.draft.confidence},
                ${result.modelId}, ${result.promptVersion})
        returning id`;
      const reportId = reportRows[0]?.id as string;
      for (const slug of result.draft.drillSlugs) {
        await tx`insert into public.coaching_recommendations (report_id, drill_slug, reason)
                 values (${reportId}, ${slug},
                         'Assigned from the mistakes identified in this analysis.')`;
      }
      await tx`update public.analysis_jobs
               set status = 'succeeded', finished_at = now(), error = null
               where id = ${job.id}`;
      await tx`update public.video_uploads set status = 'complete' where id = ${upload.id}`;
    });
    log(`job ${job.id}: succeeded (${result.observations.length} observations)`);
    return "succeeded";
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const retryable =
      error instanceof CoachProviderError
        ? error.retryable
        : !(error instanceof CoachPipelineError);
    const canRetry = retryable && job.attempts < MAX_ATTEMPTS;
    await sql`update public.analysis_jobs
              set status = ${canRetry ? "queued" : "failed"},
                  finished_at = case when ${canRetry} then null else now() end,
                  error = ${message.slice(0, 1000)}
              where id = ${job.id}`;
    if (!canRetry) {
      await sql`update public.video_uploads set status = 'failed' where id = ${job.uploadId}`;
    }
    log(`job ${job.id}: ${canRetry ? "requeued after error" : "failed"} — ${message}`);
    return canRetry ? "requeued" : "failed";
  }
}

/** Return running jobs that look abandoned (crashed worker) to the queue. */
export async function requeueStaleJobs(
  sql: postgres.Sql,
  olderThanMinutes = 15,
): Promise<number> {
  const rows = await sql`
    update public.analysis_jobs
    set status = 'queued'
    where status = 'running'
      and started_at < now() - make_interval(mins => ${olderThanMinutes})
    returning id`;
  return rows.length;
}

export interface DrainSummary {
  processed: number;
  succeeded: number;
  requeued: number;
  failed: number;
}

/** Process queued jobs until the queue is empty (single pass, no polling). */
export async function drainQueue(deps: WorkerDeps, maxJobs = 50): Promise<DrainSummary> {
  const summary: DrainSummary = { processed: 0, succeeded: 0, requeued: 0, failed: 0 };
  for (let i = 0; i < maxJobs; i++) {
    const outcome = await processNextJob(deps);
    if (outcome === "empty") break;
    summary.processed += 1;
    if (outcome === "succeeded") summary.succeeded += 1;
    if (outcome === "requeued") summary.requeued += 1;
    if (outcome === "failed") summary.failed += 1;
  }
  return summary;
}
