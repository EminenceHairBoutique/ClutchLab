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
| 7 | AI Coach | not started |
| 8 | Billing + marketplace | not started |
| 9 | Native mobile (Expo) | not started |

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

## Blockers (with exact unblocking steps)

| Blocker | Impact | Unblocking steps |
|---|---|---|
| No Supabase project credentials | App runs in explicit "auth unconfigured" mock mode; real signup/login inert | Create Supabase project → set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL` in `.env` → `pnpm db:migrate && pnpm db:seed` → unset `AUTH_MOCK`. See SETUP.md. |
| No Google/Apple OAuth credentials | OAuth buttons hidden (env-gated) | Configure providers in Supabase dashboard → set `NEXT_PUBLIC_AUTH_GOOGLE=1` / `NEXT_PUBLIC_AUTH_APPLE=1`. |
| No Sentry DSN | Error monitoring wired but disabled | Create Sentry project → set `SENTRY_DSN` + `NEXT_PUBLIC_SENTRY_DSN`. |
| No Stripe keys (Phase 8) | Billing not started yet anyway | Needed at Phase 8 only. |
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

## Next steps (exact)

1. **Phase 7 (AI Coach):** migrations for video_uploads/analysis_jobs/video_observations/
   coaching_reports/coaching_recommendations; AI provider abstraction (Anthropic default, model
   IDs from env/config, `provider.mock.ts` without credentials); upload flow (signed URLs with
   size/type limits per tier); idempotent job queue with worker loop; two-pass analysis
   (validated JSON observations → §5.13 report format) persisting model ID + prompt version +
   confidence; human-review tools in /admin. Post-match only — never live.
2. Then Phase 8 (billing/entitlements with Stripe interface + mock) per IMPLEMENTATION_PLAN.md.
