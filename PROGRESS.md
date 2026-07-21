# PROGRESS

Persistent progress ledger per spec §0.1.2. A fresh session must be able to resume from
`CLAUDE.md` + this file alone. Update after every meaningful milestone.

**Spec:** `ClutchLab_v3.md` · **Branch:** `claude/clutchlab-repo-setup-u9pkr3` (all work; push with `-u origin`)

## Phase status

| Phase | Name | Status |
|---|---|---|
| 0 | Repository audit | **done** |
| 1 | Foundation | **done** (2026-07-21, exit gate green) |
| 2 | Versioned content + meta MVP | not started |
| 3 | Settings + sensitivity MVP | not started |
| 4 | Training MVP | not started |
| 5 | Control Studio | not started |
| 6 | Community + verification | not started |
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

## Next steps (exact)

1. **Phase 2 start:** attempt web research to verify PUBG Mobile 4.5 / S31 facts (spec §24.2)
   → record findings + sources in `DATA_VERIFICATION.md`. If the sandbox network blocks
   research, seed the §2.1 baseline as `unverified` and log it here.
2. Phase 2 migrations: game_editions, regions, game_versions, patches, patch_changes, seasons,
   mode_seasons, event_windows, content_impact_links, modes, mode_rules, maps, map_versions,
   weapons, weapon_versions, weapon_stats, weapon_availability, attachments,
   attachment_versions, attachment_effects, weapon_pairings, weapon_tiers, tier_methodologies,
   meta_snapshots, meta_evidence, sources, source_snapshots, claims, claim_evidence,
   review_tasks (+ RLS + tests).
3. `packages/meta-engine` with §10 explainable scoring + unit tests.
4. `/meta` + `/weapons` routes on real data; version/season intelligence on Home.
5. `apps/admin` scaffold with publishing basics (§12 subset). Exit gate, then Phase 3.
