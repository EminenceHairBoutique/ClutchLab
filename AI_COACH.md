# AI Post-Match Coach

Implementation notes for spec §5.13. The coach analyzes **user-uploaded recordings only, after
the match** — never live gameplay, never overlays, never automation. That constraint is enforced
in the product surface (upload-then-analyze flow), the schema (analysis is derived from
`video_uploads` rows owned by the user), and the prompts (live assistance is refused).

## Architecture

```
packages/coach            provider abstraction + pipeline (framework-free)
├── types.ts              zod schemas: Observation, Mistake, ReportDraft; CoachProvider interface
├── prompts.ts            versioned system prompts (PROMPT_VERSION, §5.13 safeguards inline)
├── provider.anthropic.ts real provider — model ID from AI_COACH_MODEL, zod-validated responses
├── provider.mock.ts      deterministic mock — every artifact labeled [MOCK], confidence unverified
├── pipeline.ts           two-pass runAnalysis(): observations → report; drops unknown drill slugs
├── quota.ts              monthly analysis quota (cost guardrail §5.13.6)
└── worker.ts             queue claim (FOR UPDATE SKIP LOCKED), idempotent artifact rewrite, retries

apps/web
├── src/lib/coach/gateway.ts        provider/mode selection from validated env
├── src/lib/data/coach-store.ts     dual store: mock (in-memory) / Supabase (RLS)
├── src/app/coach/                  upload flow, quota display, report view
└── src/app/admin/coach/            human-review queue (editor role)

supabase/migrations/20260721000007_ai_coach.sql
    video_uploads → analysis_jobs (1:1, idempotency_key) → video_observations
                                                        → coaching_reports → coaching_recommendations
```

## Two-pass analysis (§5.13.4)

1. **Observation pass** — structured, timestamped, per-moment JSON observations. Direct
   observations are separated from inferences (`inference: true`). No frames → the provider must
   return `[]` rather than fabricate; the pipeline then fails the job honestly
   ("nothing analyzable was available").
2. **Synthesis pass** — one report: executive summary, the **three highest-impact mistakes**
   (what / why it mattered / better alternative, each timestamped), assigned drills (only slugs
   that exist in the training catalog — unknown slugs are dropped and logged), an optional
   settings note (only when a repeated pattern supports it), a mandatory
   **"what the model could not determine"** section, and a confidence level.

Raw observations are persisted separately from reports (§5.13.5) so reports can be regenerated
when prompts improve. Every report stores `model_id`, `prompt_version`, and `confidence`
(§5.13.7) — visible in the report footer.

## Modes

| Condition | Provider | Behavior |
|---|---|---|
| `ANTHROPIC_API_KEY` + `AI_COACH_MODEL` set | `AnthropicCoachProvider` | real two-pass analysis |
| either missing (dev/test) | `MockCoachProvider` | deterministic, loudly labeled `[MOCK]`, confidence `unverified` |
| missing in production | — | the worker **refuses to run**; the web UI shows the unconfigured banner |

Model IDs are never hard-coded: `AI_COACH_MODEL` is the only source, and env validation rejects
an API key without a model. The Anthropic provider is the only file that talks to the API.

## Job lifecycle

```
video_uploads.status: registered → uploaded → queued → processing → complete | failed
analysis_jobs.status: queued → running → succeeded | failed (attempts ≤ 5)
```

- **Queueing is idempotent**: `analysis_jobs` has `unique(upload_id)` and a unique
  `idempotency_key` (`analyze:<upload_id>`); re-requests return the existing job.
- **Processing never happens in a request handler.** In Supabase mode, `requestAnalysis` only
  inserts the queued job. The worker processes it:

  ```sh
  DATABASE_URL=postgres://... ANTHROPIC_API_KEY=... AI_COACH_MODEL=... \
    pnpm --filter @clutchlab/coach worker
  ```

  The worker drains the queue once and exits — run it on a schedule (cron, container loop, or a
  Supabase scheduled function). Claims use `FOR UPDATE SKIP LOCKED` (parallel workers safe);
  retryable failures (429/5xx/network) requeue up to 5 attempts; artifact writes are
  delete-then-insert in one transaction keyed by `job_id`, so a crashed attempt rewrites cleanly.
  `requeueStaleJobs()` returns abandoned `running` jobs (crashed worker) to the queue.
- **Mock auth mode** (no database) simulates the worker in-process with the same `runAnalysis`
  pipeline and the mock provider — instant and deterministic, clearly labeled in the UI.

## RLS model

- Owners: full visibility of their own uploads/jobs/observations/reports; can insert uploads,
  queue jobs (policy re-proves upload ownership — FK checks bypass RLS), and delete uploads.
  Deleting an upload cascades away the entire derived pipeline (privacy).
- Job status transitions and all AI artifacts (`video_observations`, `coaching_reports`,
  `coaching_recommendations`) are written **only** by the worker (service role).
- Editors: read reports and update review status (`/admin/coach` + the report page spot-check).
  Editors do **not** see the user's upload metadata — they review the AI output.

Verified by `packages/db/src/rls-coach.test.ts` (10 tests) and
`packages/db/src/worker-coach.test.ts` (5 tests) against the real migrations.

## Cost guardrails (§5.13.6)

- `MONTHLY_ANALYSIS_QUOTA` (10/user/month) enforced in the store before queueing and surfaced on
  the upload card ("X of Y used") **before** upload. Phase 8 entitlements will vary this by tier.
- `MAX_FRAMES_PER_JOB` (8) caps vision input per job.
- Attempt budget (≤5) is the circuit breaker on provider errors.

## Production blockers (tracked in PROGRESS.md)

1. **Supabase Storage**: the resumable upload flow (§5.13.1) needs a `recordings` bucket.
   `SupabaseCoachStore.createSignedUploadUrl()` implements the server side (signed upload URLs,
   path `<user_id>/<upload_id>.mp4`); the client PUT + `markUploaded` call wire up once
   credentials exist. Bucket policy: private; owners read/write their own prefix.
2. **Keyframe extraction**: the worker's `extractFrames` hook is where ffmpeg plugs in
   (adaptive sampling → base64 JPEG frames). This environment has no ffmpeg; without frames the
   providers refuse to fabricate and jobs fail honestly. Production worker image must bundle
   ffmpeg.
3. **Anthropic credentials**: `ANTHROPIC_API_KEY` + `AI_COACH_MODEL` (see `.env.example`).

## Safeguards (§5.13, enforced in prompts + schema + UI)

Never diagnoses cheating; never claims exact hit registration; separates observation from
inference (stored on each observation row, badged in the UI); shows uncertainty
(`could_not_determine` is NOT NULL); no sensitivity changes from a single miss; never claims
"zero recoil" or guaranteed outcomes; no live opponent detection of any kind. AI output is
zod-validated twice (provider + pipeline) before persistence, and human-reviewable after.
