import postgres from "postgres";

import { AnthropicCoachProvider } from "../src/provider.anthropic";
import { MockCoachProvider } from "../src/provider.mock";
import type { CoachProvider } from "../src/types";
import { drainQueue, requeueStaleJobs } from "../src/worker";

/**
 * CLI worker entry: drains the analysis job queue once, then exits.
 * Run on a schedule (cron / Supabase scheduled function / container loop):
 *
 *   DATABASE_URL=postgres://... pnpm --filter @clutchlab/coach worker
 *
 * Provider selection mirrors the web gateway: ANTHROPIC_API_KEY + AI_COACH_MODEL
 * configured -> real provider; otherwise the clearly-labeled mock.
 * Keyframe extraction (ffmpeg) is a documented production dependency — without
 * it uploads are analyzed metadata-only, which the providers refuse to
 * fabricate from (jobs then fail honestly rather than inventing coaching).
 */

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("coach-worker: DATABASE_URL is required (service-role connection)");
    process.exitCode = 1;
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  const model = process.env.AI_COACH_MODEL;
  const appEnv = process.env.APP_ENV ?? process.env.NODE_ENV ?? "development";
  let provider: CoachProvider;
  if (apiKey && model) {
    provider = new AnthropicCoachProvider({ apiKey, model });
  } else {
    if (apiKey && !model) {
      console.error("coach-worker: AI_COACH_MODEL is required when ANTHROPIC_API_KEY is set");
      process.exitCode = 1;
      return;
    }
    if (appEnv === "production") {
      // Mock analyses must never reach production users, labeled or not.
      console.error(
        "coach-worker: refusing to run the MOCK provider in production — " +
          "set ANTHROPIC_API_KEY and AI_COACH_MODEL.",
      );
      process.exitCode = 1;
      return;
    }
    provider = new MockCoachProvider();
    console.warn(
      "coach-worker: no ANTHROPIC_API_KEY configured — using the MOCK provider; " +
        "every artifact will be labeled [MOCK] with confidence 'unverified'.",
    );
  }

  const sql = postgres(databaseUrl, { max: 1, onnotice: () => {} });
  try {
    const requeued = await requeueStaleJobs(sql);
    if (requeued > 0) console.log(`coach-worker: requeued ${requeued} stale running job(s)`);
    const summary = await drainQueue({ sql, provider, log: (line) => console.log(`coach-worker: ${line}`) });
    console.log(
      `coach-worker: done — processed=${summary.processed} succeeded=${summary.succeeded} ` +
        `requeued=${summary.requeued} failed=${summary.failed} (model=${provider.modelId})`,
    );
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((error: unknown) => {
  console.error("coach-worker: fatal", error);
  process.exitCode = 1;
});
