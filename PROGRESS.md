# PROGRESS

Persistent progress ledger per spec §0.1.2. A fresh session must be able to resume from
`CLAUDE.md` + this file alone. Update after every meaningful milestone.

**Spec:** `ClutchLab_v3.md` · **Branch:** `claude/clutchlab-repo-setup-u9pkr3` (all work; push with `-u origin`)

## Phase status

| Phase | Name | Status |
|---|---|---|
| 0 | Repository audit | **done** |
| 1 | Foundation | **done** (2026-07-21, exit gate green) |
| 2 | Versioned content + meta MVP | **done** (2026-07-21, exit gate green) |
| 3 | Settings + sensitivity MVP | **done** (2026-07-21, exit gate green) |
| 4 | Training MVP | **done** (2026-07-22, exit gate green) |
| 5 | Control Studio | **done** (2026-07-22, exit gate green) |
| 6 | Community + verification | **done** (2026-07-22, exit gate green) |
| 7 | AI Coach | **done** (2026-07-22, exit gate green) |
| 8 | Billing + marketplace | **done** (2026-07-22, exit gate green) |
| 9 | Native mobile (Expo) | **done** (2026-07-22, exit gate green — device run pending, see MOBILE.md) |

Exit gate for every phase (spec §20): `pnpm lint` → `pnpm typecheck` → `pnpm test` → `pnpm build`
all green, new routes render without console errors, smoke tests exist, docs updated, committed.

## Phase 0 — Repository audit (done, 2026-07-21)

Repo state at audit: `ClutchLab_v3.md` (spec), `CLAUDE.md`, stub `README.md`,
`.claude/settings.local.json`. **No application code, no tests, no CI, no secrets committed.**
Nothing broken; nothing to preserve beyond those docs. Git history clean (3 commits, docs only).

Environment audit (shapes the Phase 1 approach):

- Node 22.22.2, pnpm 10.33.0, git 2.43. npm registry reachable.
- **Docker daemon not running** → `supabase start` (local Supabase stack) unavailable here.
- **PostgreSQL 16 server installed locally** → migrations + RLS get real integration tests
  against a local cluster instead of being mock-only.
- Playwright Chromium preinstalled at `/opt/pw-browsers/chromium` (no browser download needed).

## Phase 1 — Foundation (done, 2026-07-21)

Scope (spec §20 Phase 1): monorepo structure, design system, auth, database, RLS, environment
validation, core navigation, user profile, admin roles, CI, error monitoring.

All steps complete:

- [x] Docs: PROGRESS.md, IMPLEMENTATION_PLAN.md, CLAUDE.md refresh
- [x] Monorepo scaffold (pnpm workspace + catalog, Turborepo, strict tsconfig base)
- [x] `packages/config` — zod env validation (prod fail-fast, dev/test mock mode) + eslint preset (10 tests)
- [x] `packages/ui` — Tailwind v4 tokens + Button/Card/Badge/TierBadge/Input/Label/Tabs/Sheet/Skeleton/Stat (11 tests)
- [x] `apps/web` — shell, bottom nav (5 + More→11 §4 destinations), honest phase placeholders, disclaimer footer, PWA manifest + original icon
- [x] `supabase/` — identity migration (12 tables, RLS on all), seed (9 roles, 12 permissions, 15-device KB, nothing marked verified), auth-shim harness, **19 RLS integration tests on real Postgres**; `Database` types + `ROLE_RANKS` in `packages/types`; idempotent `db:migrate`/`db:seed` (verified against a scratch cluster)
- [x] Auth — `AuthGateway` (supabase ssr impl + `auth.mock.ts` with visible banner), middleware session refresh, login/signup/PKCE callback/signout, `/profile` guest vs authed with zod-validated save (13 unit tests)
- [x] Admin roles — DB-side `has_role_at_least` via RPC, mock rank ladder, gated `/admin` stub (5 tests)
- [x] CI (`.github/workflows/ci.yml`: lint→typecheck→test w/ PG service→build→e2e) + env-gated Sentry (server/client/onRequestError)
- [x] Playwright e2e: 15 tests — all 11 routes console-error-free on a mobile viewport, More-sheet IA, signup→profile-save→signout, bad-credential rejection, admin gate
- [x] SETUP.md, ARCHITECTURE.md, .env.example, README refresh

**Exit gate (run at repo root, 2026-07-21):** `pnpm lint` ✅ (5 workspaces) · `pnpm typecheck` ✅
(5 workspaces) · `pnpm test` ✅ (67 tests: 10 config + 11 ui + 19 RLS integration + 27 web) ·
`APP_ENV=test pnpm build` ✅ (clean, no warnings) · `APP_ENV=test pnpm e2e` ✅ (15 Playwright
tests, all 11 routes console-error-free on a mobile viewport).

## Decisions log

| # | Date | Decision | Why |
|---|---|---|---|
| D1 | 2026-07-21 | Turborepo + pnpm workspaces | Spec §8.2 suggestion; standard task caching. Fallback to plain `pnpm -r` if turbo binary unavailable. |
| D2 | 2026-07-21 | Next.js 15 App Router, React 19, TS strict, Tailwind v4, ESLint 9 flat | Current stable at implementation time (§8). Next-over-Vite rationale in ARCHITECTURE.md per §8.2. |
| D3 | 2026-07-21 | shadcn-style components vendored manually into `packages/ui` (Radix deps) | No network/CLI dependency; full control; spec allows "shadcn/ui or equivalent". |
| D4 | 2026-07-21 | System font stack (UI) + monospace stack (numerals) for now | Sandbox blocks font CDN fetch at build; swap to bundled variable font documented in ARCHITECTURE.md. |
| D5 | 2026-07-21 | Migrations are Supabase-compatible SQL; local PG16 cluster + `auth` shim (`supabase/tests/harness/`) runs them + RLS integration tests in vitest | Docker/`supabase start` unavailable in this environment; this keeps RLS *actually tested* while staying deployable to real Supabase unchanged. |
| D6 | 2026-07-21 | Auth behind a small provider interface: real `@supabase/ssr` impl + `auth.mock.ts` in-memory impl auto-selected when Supabase env absent (or `AUTH_MOCK=1`) | Spec §0.1.7 honest-placeholder protocol; no Supabase project credentials exist yet. |
| D7 | 2026-07-21 | Sentry wired but inert without `SENTRY_DSN` | §20 Phase 1 "error monitoring" with no DSN credential yet. |
| D8 | 2026-07-21 | Admin **console app** deferred to Phase 2; Phase 1 ships roles/permissions schema + `requireRole` + role-gated `/admin` stub | §20 Phase 1 requires "admin roles", console is §12; keeps Phase 1 coherent. |
| D9 | 2026-07-21 | Phase 1 packages: `config`, `types`, `ui` only; `meta-engine`/`calibration`/`analytics`/`content` created in their phases | Avoid empty shells; spec structure preserved. |
| D10 | 2026-07-21 | Device knowledge-base rows carry `data_status` (`verified|unverified|sample`) + source columns in the DB | Spec §0.1.8/§2.2: no invented data; status lives in the database, not just UI. |
| D11 | 2026-07-21 | Vitest for unit/component; Playwright smoke E2E via preinstalled Chromium | Exit gate literally requires routes rendering without console errors; Playwright verifies it honestly. |
| D12 | 2026-07-21 | `@supabase/ssr` pinned ≥0.12 with supabase-js ≥2.110 | ssr 0.6 predates supabase-js 2.110's changed `SupabaseClient` generic arity — typed queries collapsed to `never`. Keep the pair in lockstep. |
| D15 | 2026-07-21 | Content catalog lives in `packages/content` (typed, zod-validated) and generates `supabase/seed_content.sql` deterministically; tiers computed through the meta-engine at generation time | One source of truth for seed AND unconfigured-mode reads; seeded numbers can never diverge from live scoring. CI drift-checks the generated file. |
| D16 | 2026-07-21 | Editorial console ships inside apps/web at `/admin` (not a separate apps/admin yet) | Avoids duplicating the auth/session stack for a 4-page console; revisit when the §12 surface grows. |
| D17 | 2026-07-21 | Weapon numeric stats (damage/RoF/velocity/magazines) seeded as ABSENT, not estimated | Spec §2.2/§5.3: no unsupported precision. `weapon_stats` is an EAV table that only ever holds sourced values; UI renders "not yet verified" states. |
| D18 | 2026-07-21 | Editorial baseline snapshot published with confidence `low` + evidence notes; arena modes excluded from tier seeding | Publishing clearly-labeled editorial analysis is §2.2-compliant; arena tiers deferred until researched (review task open). |
| D13 | 2026-07-21 | Verification builds declare `APP_ENV=test`; session pages are `force-dynamic`; env validated at server boot (`instrumentation.ts`) | Production without Supabase must fail fast (spec), while CI/sandbox builds without secrets must pass the gate. Session UIs must never bake auth state into static HTML. |
| D14 | 2026-07-21 | RLS harness drops to the `postgres` system user via `runuser` when running as root | PostgreSQL refuses to run as root; container sandboxes run as root. Non-root dev machines/CI exec directly. |
| D19 | 2026-07-22 | AI coach lives in `packages/coach` (providers + pipeline + queue worker), not in apps/web | The worker must run without the Next.js app; one abstraction serves web, worker, and later mobile. Provider gateway (env → provider) stays in apps/web. |
| D20 | 2026-07-22 | Mock auth mode simulates the analysis worker in-process using the SAME `runAnalysis` pipeline + mock provider; Supabase mode only queues (worker processes) | Demo stays fully self-contained and instant without violating the background-job rule for real video: the mock provider does no video processing. Production worker refuses the mock provider outright. |
| D21 | 2026-07-22 | Mock-only affordance: signup emails starting `editor-` get the editor role | Human-review tools (§5.13.7) must be demoable + e2e-testable without a database. Unreachable in production (env validation forbids mock mode); real role grants stay server-side. |
| D22 | 2026-07-22 | Coach quota is a single constant (10/month) enforced in the store and shown pre-upload | §5.13.6 requires surfacing quota before upload now; per-tier variation belongs to Phase 8 entitlements, avoiding scattered plan checks today. (Superseded by D25 in Phase 8.) |
| D23 | 2026-07-22 | Stripe client is fetch-based (no stripe SDK): 3 endpoints + HMAC webhook verify, zod-validated | Tiny surface, zero new deps, fully testable with injected fetch/clock; the SDK adds nothing we use. |
| D24 | 2026-07-22 | Plan state changes ONLY via the signed webhook (service-role); checkout redirects never mutate plan | Payment truth lives with Stripe; client-visible success pages are not proof of payment. Mock mode (dev/test) switches directly with a loud banner and is refused in production. |
| D25 | 2026-07-22 | Free plan gets 0 AI analyses; Pro 10/mo (no full-match); Elite 30/mo (all kinds) — encoded in the entitlements matrix | §14 lists AI reviews under Pro/Elite only. Coach quota now derives from entitlements (supersedes D22). |
| D26 | 2026-07-22 | Sample marketplace coaches live in the MOCK store only (labeled, not bookable); the real DB gets no seeded coaches | coach_profiles FKs auth users — seeding fake humans into a real Supabase would pollute auth and imply real people. Demo mode stays rich; production stays clean. |
| D27 | 2026-07-22 | Coach verification is trigger-protected in Postgres (only editor+ can flip `verified`) | RLS alone can't do column-level protection cleanly; the trigger makes self-verification impossible even through the owner-update policy. |
| D28 | 2026-07-22 | Mock-only affordance extended: `admin-` signup emails get the admin role | Payout workflow (money) is admin-gated above the editor gate; needs to be demoable + e2e-testable without a database. Same safety argument as D21. |
| D29 | 2026-07-22 | Design tokens exported as JS (`@clutchlab/ui/tokens`) with a unit test asserting exact equality against theme.css | Mobile can't consume CSS custom properties; a drift-guard test beats generation tooling at this scale. Web CSS stays the source of truth. |
| D30 | 2026-07-22 | Mobile navigation = four tabs on local state + expo-linking; no navigation library yet | Flat screen graph doesn't justify expo-router's native-module tail (screens/gesture-handler/reanimated) in an environment where nothing native can run; deep-link mapping is isolated in tabForUrl() so graduating later is cheap. |
| D31 | 2026-07-22 | Mobile ships reader-first: account features link to the web app; auth/uploads/push are documented milestones in MOBILE.md | Honest-placeholder protocol: real Supabase/EAS credentials and a physical device don't exist here; shipping unverifiable auth UI would be pretend-complete. The bundled-catalog readers are fully real and offline-capable. |
| D32 | 2026-07-22 | iPhone distribution = the PWA (Add to Home Screen); the Expo app remains the native track | Full app on iPhone today with zero store/credential dependencies: standalone display, offline shell, and (once VAPID keys exist) push for installed web apps. Hand-rolled SW over a plugin: 3 explicit strategies beat opaque precache manifests. |
| D33 | 2026-07-22 | §9 tables `drill_versions`, `drill_steps`, `benchmarks`, `source_snapshots`, `content_revisions` deliberately deferred | Each is a versioning/audit refinement of a live feature with no behavior behind it yet; schema-only tables would be fake completeness. Revisit when drill editing, measured benchmarks, or editorial revision history become real workflows. |
| D34 | 2026-07-22 | Notification kinds are exactly the §5.18 twelve; product events map onto them (AI report + bookings → coach_response) rather than inventing new kinds | Keeps the preference matrix legible and spec-faithful; per-event splits can arrive later as sub-preferences if users need finer control. |
| D35 | 2026-07-22 | Ship the monorepo to `main` via PR; require Vercel Root Directory = `apps/web` | `main` had a flat, mismatched layout that likely failed to build; the monorepo is the real product. Root Directory is the one setting that makes it deploy (DEPLOYMENT.md). |
| D36 | 2026-07-22 | JSON-LD uses TechArticle/BreadcrumbList + a bare SoftwareApplication Offer — never aggregateRating/reviewCount | Structured data must be truthful (no fabricated review scores); tiers are editorial baselines, not ratings. |
| D37 | 2026-07-22 | Next 16 builds with `--webpack`; keep the Sentry OTel webpack warning-suppression | Next 16 defaults to Turbopack, which conflicts with the existing webpack customization and crashed the build worker; `--webpack` is supported and preserves the working config. |
| D38 | 2026-07-22 | Hold eslint 10, TS 7, zod 4, and the vitest4/vite8 stack; take Next 16 + TS 6 + Sentry 10 + lucide 1 | Gate-driven: eslint 10 breaks the Next plugin tree (eslint-plugin-react 7.37), TS 7 is a dev build capped out by typescript-eslint, zod 4 is ~28 breaking sites for little benefit, and vitest 4 needs vite 8 + new babel peers. Revisit as the ecosystem catches up. |

## Blockers (with exact unblocking steps)

| Blocker | Impact | Unblocking steps |
|---|---|---|
| No Supabase project credentials | App runs in explicit "auth unconfigured" mock mode; real signup/login inert | Create Supabase project → set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL` in `.env` → `pnpm db:migrate && pnpm db:seed` → unset `AUTH_MOCK`. See SETUP.md. |
| No Google/Apple OAuth credentials | OAuth buttons hidden (env-gated) | Configure providers in Supabase dashboard → set `NEXT_PUBLIC_AUTH_GOOGLE=1` / `NEXT_PUBLIC_AUTH_APPLE=1`. |
| No Sentry DSN | Error monitoring wired but disabled | Create Sentry project → set `SENTRY_DSN` + `NEXT_PUBLIC_SENTRY_DSN`. |
| No Stripe keys | Billing runs in labeled mock mode; production billing refuses | Create Stripe products/prices → set `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_PRO`, `STRIPE_PRICE_ELITE` → add webhook endpoint `/api/stripe/webhook`. See SETUP.md. |
| No Stripe Connect | Marketplace payouts are a manual admin ledger, not real transfers | Enable Stripe Connect (Express) → onboard coaches → replace `markPayoutPaid` manual step with Transfer API calls. |
| No Anthropic API key/model | Coach runs the labeled mock provider; real analyses inert | Set `ANTHROPIC_API_KEY` + `AI_COACH_MODEL` in `.env` (worker env too). See AI_COACH.md. |
| No Supabase Storage bucket | Real recording upload (signed URLs) inert; metadata flow works | With Supabase creds: create private `recordings` bucket; client PUT + `markUploaded` wire-up per AI_COACH.md. |
| No ffmpeg in this environment | Worker analyzes metadata-only → providers refuse to fabricate → honest job failure | Bundle ffmpeg in the worker image; implement `extractFrames` hook (interface ready) per AI_COACH.md. |
| Web research from sandbox unverified | §24.2 fact verification (PUBG 4.5/S31 dates) may be blocked by network policy | Attempt at Phase 2 start; if blocked, seed §2.1 baseline as `unverified` and record in DATA_VERIFICATION.md. |

## Phase 2 — Versioned content + meta MVP (done, 2026-07-21)

- Research pass: 7 claims corroborated via secondary sources → `DATA_VERIFICATION.md`; all
  seeded as `unverified` with sources attached. Could-not-verify list drives 4 seeded review
  tasks (official notes capture, UR end date, Mobile map rotation, per-weapon balance details).
- Migration 0002: 27 content tables (versions/seasons/patches+changes+impacts, modes+rules,
  maps+map_versions, weapons/attachments/effects/pairings, tier methodologies/snapshots/tiers/
  evidence, sources/claims/evidence, review_tasks, content_revisions) — RLS everywhere: public
  catalog reads, editor+ writes, draft snapshots hidden by policy, editorial-internal queues.
- `packages/meta-engine`: §10 explainable scoring — labeled breakdown summing to the score,
  per-mode weights, availability-adjusted view, aim-assist-off recoil penalty, confidence
  discount, reason-required editorial overrides. 16 tests.
- `packages/content`: typed catalog (26 §5.3 weapons, 27 attachments with qualitative-only
  effects, 7 modes, 8 maps, seasons/patch/claims) → deterministic `seed_content.sql`
  (CI drift check) + bundled read path for unconfigured mode.
- Web: `/meta` per-mode tier boards with expandable why-this-tier breakdowns; `/weapons` +
  detail pages with patch-impact banners and explicit not-yet-verified stats; home version &
  season intelligence with countdowns; sitemap/robots. Provenance disclosed on every meta page.
- `/admin` editorial console: overview counts, review queue (start/done/dismiss), version
  creation (source required, starts unverified), snapshot publish/archive; all mutations write
  `content_revisions`; every write path RLS-enforced in the database.

**Exit gate (repo root, 2026-07-21):** `pnpm lint` ✅ (7 workspaces) · `pnpm typecheck` ✅ ·
`pnpm test` ✅ (126 tests: 10 config + 11 ui + 16 meta-engine + 21 content + 31 db/RLS + 37 web)
· `APP_ENV=test pnpm build` ✅ · `APP_ENV=test pnpm e2e` ✅ (21 tests).

## Phase 3 — Settings + sensitivity MVP (done, 2026-07-21)

- Migration 0003: settings library (+per-version retest flags), user-owned sensitivity profiles
  with **immutable version history** (no update/delete policies — rollback appends), 1–300
  value constraints, verbatim `setting_codes`, calibration catalog + owner-scoped results and
  recommendations, pro vault (profiles/teams/settings/verification tables). 21 RLS tests → 42.
- `packages/calibration`: family×scope model, the §5.7 14-step guided flow enforcing
  one-variable-at-a-time, honest ±5% bucketed recommendations ("check grip before chasing
  numbers"). 12 tests.
- Content: 35 settings explainers (§5.6 fields), the calibration catalog seeded from the same
  package, 3 sample teams + 10 pro profiles that are **explicitly fictional** (sample
  verification + fictional notes) — never invented settings for real players.
- Web: `/settings` explainer library; `/settings/sensitivity` builder (create → edit grid →
  save-as-version → rollback → verbatim codes → guided calibration wizard committing one
  version with per-step results and server-computed recommendations); `/pros` vault with
  verification badges, staleness display, delta comparison, and fork-to-my-profile.
- Deviation logged: Aim Assist Decision Lab shipped as explainer content only; the structured
  on/off A/B test drills land with Phase 4's drill engine (they are drills by nature).

**Exit gate (repo root, 2026-07-21):** `pnpm lint` ✅ (8 workspaces) · `pnpm typecheck` ✅ ·
`pnpm test` ✅ (155 tests: 10 config + 11 ui + 16 meta-engine + 12 calibration + 25 content +
42 db/RLS + 39 web) · `APP_ENV=test pnpm build` ✅ · `APP_ENV=test pnpm e2e` ✅ (28 tests).

## Phase 4 — Training MVP (done, 2026-07-22)

- Migration 0004: skills/drills(+versions/steps)/plans(+items)/benchmarks (public, editor-write),
  user_training_sessions + drill_results (owner-scoped). 47 db tests total.
- Content: 20-skill taxonomy, **42 drills** with full §5.10 structure including the aim-assist
  A/B pairs (§5.6 decision lab as drills), **10 plans** (5–60 min incl. 45-min UR aim-assist-off
  program), benchmarks derived from drill criteria, WoW directory with **no invented map codes**.
- Web: `/training` overview (weekly summary, generator form, plans, drill browser, WoW),
  drill sheets with result logging, plan/generated session starts, session runner with
  per-drill results and completion notes. Deterministic budget-capped plan generator (8 tests).
- Deviations logged: weekly summary is the §5.14 slice (sessions/minutes/results/pass rate) —
  richer daily/monthly/patch-adaptation reports build on drill_results in later phases;
  drill_steps table exists but drills currently encode steps in prose fields.

**Exit gate (repo root, 2026-07-22):** `pnpm lint` ✅ (8 workspaces) · `pnpm typecheck` ✅ ·
`pnpm test` ✅ (173 tests: 10 config + 11 ui + 16 meta-engine + 12 calibration + 30 content +
47 db/RLS + 47 web) · `APP_ENV=test pnpm build` ✅ · `APP_ENV=test pnpm e2e` ✅ (32 tests).

## Phase 5 — Control Studio (done, 2026-07-22)

- Migration 0005: control_elements catalog, user-owned control_layouts with immutable
  control_layout_versions + normalized control_positions, per-version control_analysis,
  drill-linked control_test_results. Owner-chain RLS matching the sensitivity pattern.
- Ergonomics engine (`apps/web/src/lib/controls/ergonomics.ts`, versioned `ergonomics-v1`):
  aspect-corrected distances, finger-zone assignment, collision/edge/notch detection,
  right-thumb congestion (spec §5.9's canonical finding verbatim), chained-action travel.
- 21-element original catalog + 4 sample templates (2/3/4/5-finger) in packages/content;
  elements seeded to DB; templates are UI starting points.
- /controls: template-based creation, pointer-drag editor with LIVE analysis (score badge +
  severity-coded findings), per-element resize, save-as-version, rollback, §5.9 test-drill links.
- Deviations logged: workload heat map rendered as category-colored elements + per-zone finding
  text (graphical heat overlay deferred); layout sharing deferred to Phase 6 (community);
  control_test_results table ready but results log through drill pages for now.

**Exit gate (repo root, 2026-07-22):** `pnpm lint` ✅ · `pnpm typecheck` ✅ · `pnpm test` ✅
(182 tests: 10 config + 11 ui + 16 meta-engine + 12 calibration + 30 content + 47 db/RLS +
56 web) · `APP_ENV=test pnpm build` ✅ · `APP_ENV=test pnpm e2e` ✅ (34 tests).

## Phase 6 — Community + verification (done, 2026-07-22)

- Migration 0006: posts/comments with status-driven visibility (denormalized author labels keep
  profiles private), reactions, reports, moderation_actions, reputation_events,
  correction_requests, creator_profiles/content. RLS enforces the moderation model end to end
  (8 new tests, 55 db total).
- `/community`: composer with conservative rule-based §5.16 risk screening (7 categories,
  hold-for-review only — flags never auto-remove), post pages with comments/reactions/reports.
- `/admin/moderation`: moderator-gated queue, remove/dismiss with a mandatory
  moderation_actions audit row. Correction requests route to editors.
- `MODERATION.md` policy shipped (deliverable §22.11).
- Deviations logged: layout/settings sharing is text-based post kinds (live embeds of private
  layouts deferred); creator portal is schema + RLS only, UI grows with the marketplace phase;
  appeals handled as correction-kind posts.

**Exit gate (repo root, 2026-07-22):** `pnpm lint` ✅ · `pnpm typecheck` ✅ · `pnpm test` ✅
(192 tests: 10 config + 11 ui + 16 meta-engine + 12 calibration + 30 content + 55 db/RLS +
58 web) · `APP_ENV=test pnpm build` ✅ · `APP_ENV=test pnpm e2e` ✅ (37 tests).

## Phase 7 — AI Coach (done, 2026-07-22)

- Migration 0007: `video_uploads` (8 §5.13 kinds incl. screenshot subtypes) → `analysis_jobs`
  (1:1, unique `idempotency_key`, attempts ≤5) → `video_observations` + `coaching_reports`
  (model_id + prompt_version + confidence NOT NULL, review_status) → `coaching_recommendations`
  (FK into drills). RLS: owners own their pipeline (cascade delete = privacy), the job-insert
  policy re-proves upload ownership (FK checks bypass RLS), status transitions + AI artifacts are
  worker/service-role only, editors read + review reports. 10 RLS tests.
- `packages/coach`: `CoachProvider` interface; `AnthropicCoachProvider` (model from
  `AI_COACH_MODEL` only, zod-validated responses, fence-tolerant JSON, retryable-vs-not errors,
  8-frame budget); deterministic `provider.mock.ts` (all artifacts `[MOCK]`/unverified);
  versioned prompts embedding every §5.13 safeguard; two-pass `runAnalysis` that re-validates
  both passes, fails honestly on zero observations, and drops unknown drill slugs; monthly quota
  (10, Phase 8 varies by tier); queue worker (`FOR UPDATE SKIP LOCKED` claim, idempotent
  delete+insert artifact rewrite, stale-job requeue, refuses mock provider in production).
  19 unit tests + 5 worker integration tests against the real schema.
- Web: `/coach` (register → attach → analyze flow, quota surfaced pre-upload, mode banners,
  boundaries stated), `/coach/reports/[id]` (full §5.13 output: timestamped top-3 mistakes,
  drills linking into the academy, settings note only when supported, mandatory
  could-not-determine, observation timeline with inference badges, model+prompt footer),
  `/admin/coach` review queue + on-report editorial spot-check. 4 e2e tests including the
  editor round trip.
- `AI_COACH.md` shipped; SETUP.md/.env.example/CLAUDE.md updated.
- Deviations logged: real keyframe extraction (ffmpeg) and Supabase Storage signed-URL upload are
  implemented as interfaces + documented production steps (no creds/ffmpeg here); mock auth mode
  simulates the worker in-process with the same pipeline (D20).

**Exit gate (repo root, 2026-07-22):** `pnpm lint` ✅ · `pnpm typecheck` ✅ · `pnpm test` ✅
(226 tests: 10 config + 11 ui + 16 meta-engine + 12 calibration + 30 content + 19 coach +
70 db/RLS/worker + 58 web) · `APP_ENV=test pnpm build` ✅ · `APP_ENV=test pnpm e2e` ✅ (41 tests).

## Phase 8 — Billing + marketplace (done, 2026-07-22)

- `packages/billing`: §14 entitlements matrix in ONE place (coach analyses/month + allowed
  upload kinds, sensitivity profile & control layout limits, vault depth, coach discount) —
  features call helpers, never compare plan strings; SDK-free Stripe provider (fetch + zod,
  HMAC webhook verification with timestamp tolerance, subscription lifecycle mapped through
  configured price IDs) + `stripe.mock.ts`; 20% platform fee split helper backed by the
  ledger CHECK. 15 unit tests. Env: `STRIPE_SECRET_KEY` requires webhook secret + price IDs.
- `/billing`: public §14 plan cards, current-plan card, mock-mode instant switches (loudly
  labeled; production refuses), Stripe checkout/portal redirects when configured;
  `/api/stripe/webhook` is the only writer of plan state (service-role upsert).
- Entitlements enforced server-side: free = 0 AI analyses (§14 lists none) with an explicit
  upgrade card, Pro = 10/month without full-match, Elite = 30/month incl. full-match; free =
  1 sensitivity profile and 1 control layout (create actions + pro-fork all gate through one
  checked helper).
- Marketplace (§5.17): migration 0008 (coach_profiles with trigger-protected verification,
  coach_services, bookings, marketplace_orders with fee+net=amount CHECK, coach_reviews),
  RLS (participant-only bookings, verified-only directory, completed-booking reviews,
  admin-only ledger) — 8 RLS tests; directory + coach detail + booking workflow
  (request→accept→deliver→confirm) + reviews; `/admin/coach` verifies coach credentials;
  `/admin/payouts` (admin role) fee-split ledger with mark-paid. Credential-request language
  rejected at listing/booking layer; sample coaches exist in mock mode only, labeled, not
  bookable.
- E2E: billing (4 — §17 critical "user upgrades" incl. re-lock on downgrade, Elite gate,
  free profile cap) + marketplace (2 — full apply→verify→book→deliver→confirm→review→payout
  loop across four sessions). Coach e2e updated for the plan gate.

**Exit gate (repo root, 2026-07-22):** `pnpm lint` ✅ · `pnpm typecheck` ✅ · `pnpm test` ✅
(251 tests: 12 config + 11 ui + 16 meta-engine + 12 calibration + 30 content + 19 coach +
15 billing + 78 db/RLS/worker + 58 web) · `APP_ENV=test pnpm build` ✅ ·
`APP_ENV=test pnpm e2e` ✅ (47 tests).

## Phase 9 — Native mobile (done, 2026-07-22)

- `apps/mobile`: Expo SDK 57 (React 19.2 / RN 0.86 — pnpm isolates them from the web app's
  React 19.1), TS strict, shared eslint preset. Four-tab reader MVP: Home (version 4.5
  intelligence with data-status/confidence/source labeling + independent-product and
  no-automation statements), Meta (tier list per mode from the SAME versioned engine and
  bundled baseline as the web/seed), Train (drills grouped by skill + plans), More (web
  links for account features, honest notifications state, privacy statement).
- Shared design tokens: `@clutchlab/ui/tokens` (react-free) with a unit test that parses
  `theme.css` and fails on any drift (web CSS stays the source of truth).
- Deep links: `clutchlab://<tab>` + `https://clutchlab.app/...` (Android intent filter
  configured) resolve through unit-tested `tabForUrl()`; web-only sections land on the
  closest tab; account features open the web app until mobile sign-in ships.
- Offline: reader screens consume the bundled catalog — fully offline by construction.
- Verification WITHOUT a device (none exists here): lint + typecheck + 8 unit tests +
  `expo export` Metro-bundling ios+android to Hermes bytecode (624 modules). On-device Expo
  Go run, push notifications (EAS credentials), and mobile auth/uploads are documented as
  the next milestones in MOBILE.md — interfaces and server pieces already exist.

**Exit gate (repo root, 2026-07-22):** `pnpm lint` ✅ (11 workspaces) · `pnpm typecheck` ✅ ·
`pnpm test` ✅ (260 tests: 12 config + 12 ui + 16 meta-engine + 12 calibration + 30 content +
19 coach + 15 billing + 8 mobile + 78 db/RLS/worker + 58 web) · `APP_ENV=test pnpm build` ✅
(Next.js production build + expo export) · `APP_ENV=test pnpm e2e` ✅ (47 tests).

## Post-phase slices — PWA, notifications, report cadence (done, 2026-07-22)

Built after Phase 9 to close the spec sections that aren't numbered phases:

- **iPhone PWA (§18)**: PNG icon set generated from the original mark (`generate:icons`
  script; iOS ignores SVG manifest icons), maskable variant, standalone display +
  apple-web-app metadata, service worker (network-first navigations with `/offline`
  fallback, cache-first hashed assets, push handlers), registered app-wide. Install path:
  Safari → Share → **Add to Home Screen**. 4 e2e tests verify manifest, metadata, an
  ACTIVE registration, and the offline page.
- **Notifications (§5.18 + §9 tables)**: migration 0009 — `notification_preferences`
  (12 kinds, strictly opt-in default OFF), server-written `notifications` inbox,
  `push_subscriptions`; owner-only RLS (4 tests). `notify()` gates on preference; live
  triggers: AI report ready (mock pipeline + background worker SQL), report review
  outcomes, booking request/response/delivery, community replies. `/notifications` =
  inbox + preference matrix + per-device push (web-push behind VAPID env, honest
  unconfigured state; iPhone push requires Home Screen install per iOS). 3 e2e tests
  prove silence without opt-in and delivery with it.
- **Report cadence (§5.14)**: `/training/reports` — daily/weekly/monthly aggregates over
  logged data only + consecutive-day practice streak (unit-tested edge cases). No
  fabricated metrics, stated in the UI.

**Gate (repo root, 2026-07-22):** `pnpm lint` ✅ · `pnpm typecheck` ✅ · `pnpm test` ✅
(270 tests: 12 config + 12 ui + 16 meta-engine + 12 calibration + 30 content + 19 coach +
15 billing + 8 mobile + 82 db + 64 web) · `APP_ENV=test pnpm build` ✅ ·
`APP_ENV=test pnpm e2e` ✅ (54 tests).

## Audit + upgrade pass (2026-07-22)

Triggered by "audit the repo + live site, upgrade/integrate/refresh." Key audit finding:
**`main` had diverged into a flat, mismatched layout that likely failed to build on Vercel** —
the live site (`clutchlabv3.vercel.app`) was not running this monorepo. Resolution: a PR brings
the monorepo to `main` (Vercel Root Directory must be set to `apps/web` — see DEPLOYMENT.md).
The live URL returned 403 to automated fetches (bot protection or a failed deploy — couldn't
inspect it directly).

Delivered (all gate-green — 273 unit/integration tests, 55 e2e):

- **Data refresh (§2):** re-verified 4.5/S31 is current; enriched with corroborated details
  (Naruto across Erangel/Livik/Sanhok, Scuderia Ferrari collab, Fast Swim, Monster Truck
  handling, Metro Royale Ch.33). All `unverified` with sources; claim C8 logged; seed regen'd.
- **SEO/UX (§19):** JSON-LD site graph (Organization/WebSite/SoftwareApplication) + weapon
  TechArticle/BreadcrumbList (no fabricated ratings); notifications nav bell with live unread
  badge (static-safe via a tiny no-store endpoint); fixed stale nav "in-development" flags.
- **Production hardening:** security headers + `/sw.js` no-cache in `next.config` (portable);
  `@clutchlab/coach`/`billing` added to `transpilePackages`; **DEPLOYMENT.md** (Vercel Root
  Directory fix, env matrix, pooler-based migrate/seed, smoke checklist).
- **Dependency upgrades:** Next 15→16 (webpack build), TypeScript 5.9→6.0, @sentry/nextjs
  9→10, lucide 0.5→1.25, typescript-eslint 8.65, jsdom 29, jest-dom 7, eslint-config-next 16
  (native flat config). **Held with reasons:** eslint 10 (Next plugin tree not ready), TS 7
  (dev build; typescript-eslint peers <6.1.0), zod 4 (~28 breaking sites, low benefit),
  vitest 4/vite 8 stack (coordinated major, low value). See decisions D35–D38.

## Project state: all nine phases complete

Every §20 phase is built, tested, and gate-green in demo (mock) mode. What separates this
from production is credentials, not code — each blocker below lists its exact unblocking
steps. The spec's hard rules are enforced in schema, tests, prompts, and copy throughout:
no gameplay automation, no fabricated data (everything unverifiable is stored `unverified`/
`sample` in the database), no "zero recoil" claims, no copyrighted assets, no client-side
secrets, RLS on every user-owned table.

**Hardening backlog (post-phase, credential-dependent):** connect Supabase (+ `recordings`
bucket) and run migrations/seed → real auth + RLS in production; Anthropic key + model +
ffmpeg worker image → real analyses; Stripe (+ Connect) → real billing + payouts; EAS
credentials → mobile device builds + push; Sentry DSN; Google/Apple OAuth.
