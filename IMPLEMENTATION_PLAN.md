# IMPLEMENTATION_PLAN

> **Status (2026-07-22): all nine phases are built and gate-green.** This file remains the
> phase map; PROGRESS.md carries per-phase results, decisions, and the credential blockers
> that separate demo mode from production.

Concise execution map from `ClutchLab_v3.md` (§20 phases, §24 loop). Detail lives in the spec;
this file records *how* each phase lands in this codebase. Status tracking is in `PROGRESS.md`.

## Target structure (spec §8.1)

```
apps/web              Next.js 15 App Router PWA (mobile-first, dark-first)
apps/admin            Admin/editorial console (Phase 2+)
apps/mobile           Expo React Native (Phase 9)
packages/config       Env validation (zod), shared tsconfig/eslint presets
packages/types        Shared domain + generated Database types
packages/ui           Design system: Tailwind v4 tokens + shadcn-style components
packages/meta-engine  Explainable weapon scoring/tiering (Phase 2)
packages/calibration  Sensitivity algorithms (Phase 3)
packages/analytics    Event taxonomy (Phase 4+)
packages/content      Content schemas/validators (Phase 2+)
supabase/             config.toml, migrations/, seed.sql, tests/harness/ (auth shim + RLS tests)
```

Root scripts: `dev` `lint` `typecheck` `test` `build` `db:migrate` `db:seed` (Turborepo).

## Phase 1 — Foundation (current)

| Deliverable | Implementation |
|---|---|
| Monorepo | pnpm workspaces + Turborepo; TS strict everywhere; ESLint 9 flat config |
| Design system | `packages/ui`: Tailwind v4 `@theme` tokens — graphite `#0a0b0d` bg, panel neutrals, electric accent, tier colors S–F with text labels (color-independent), mono numerals; Button/Card/Badge/Input/Label/Tabs/Sheet/Skeleton/TierBadge |
| Env validation | `packages/config`: zod schemas, server/client split; prod fails fast, dev/test exposes explicit `unconfigured` mode |
| Database + RLS | `supabase/migrations/*.sql`: profiles, player_profiles, devices (device KB), user_devices, player_goals, user_preferences, roles, permissions, role_permissions, user_roles, subscriptions (stub), audit_logs. RLS on all user-owned tables; `has_role()`/`is_admin()` security-definer helpers; profile auto-create trigger. Seeds: 9 roles (§13), device KB with `data_status`+source. Local PG16 harness applies an `auth` shim then real migrations; vitest RLS integration suite |
| Auth | `@supabase/ssr` (browser/server/middleware) behind a thin provider interface; `auth.mock.ts` when unconfigured; email/password + env-gated Google/Apple; guest browsing default |
| Core navigation | Bottom nav Home/Meta/Train/Coach/Profile + More sheet → all 11 §4 destinations; honest placeholder pages; independent-product disclaimer in footer |
| User profile | `/profile` auth-gated; Phase-1 subset of §5.1 (display name, edition/region, device from KB, finger count, grip); zod server actions |
| Admin roles | Roles/permissions schema + `requireRole` + gated `/admin` stub (console app in Phase 2) |
| CI | GitHub Actions: pnpm → lint → typecheck → test (PG service for RLS) → build |
| Error monitoring | `@sentry/nextjs`, enabled only with DSN |
| Tests | vitest unit/component; RLS integration on local PG; Playwright smoke: all 11 routes render, zero console errors |

## Phase 2 — Versioned content + meta MVP

- Research pass (§24.2): verify 4.5/S31 facts → `DATA_VERIFICATION.md`; unverifiable → `unverified` status rows.
- Migrations: game_editions, regions, game_versions, patches, patch_changes, seasons, mode_seasons,
  event_windows, content_impact_links, modes, mode_rules, maps, map_versions, weapons,
  weapon_versions, weapon_stats, weapon_availability, attachments, attachment_versions,
  attachment_effects, weapon_pairings, weapon_tiers, tier_methodologies, meta_snapshots,
  meta_evidence, sources, source_snapshots, claims, claim_evidence, review_tasks.
- `packages/meta-engine`: §10 explainable scoring (stored components, methodology version,
  editorial overrides, historical snapshots) + exhaustive unit tests.
- Routes: `/meta` (mode/map/range filters, tier list with "why this tier"), `/weapons`,
  `/weapons/[slug]` (§5.4 data + disclosure of assumptions), version/season intelligence on `/`.
- `apps/admin` scaffold: version/patch/season CRUD, tier editor, meta snapshot publisher (§12 subset).
- Seed 4.5/S31 weapon catalog (§5.3 list) with per-row evidence + confidence.

## Phase 3 — Settings + sensitivity MVP

- Migrations: setting_definitions, setting_versions, sensitivity_profiles, sensitivity_values,
  sensitivity_tests, sensitivity_test_results, sensitivity_recommendations, setting_codes,
  profile_forks, profile_change_logs. Pro tables: pro_profiles, teams, pro_team_history,
  pro_settings, verification_sources, verification_reviews.
- `packages/calibration`: §5.7 guided flow state machine (one variable at a time) + tests.
- Routes: `/settings` (≥30 explainers seeded), `/settings/sensitivity` builder + calibration flow,
  profile versioning/rollback, `/pros` vault + comparison/fork. Codes stored verbatim, never parsed
  into fabricated values; never "zero recoil".

## Phase 4 — Training MVP

- Migrations: skills, drills, drill_versions, drill_steps, training_plans, training_plan_items,
  user_training_sessions, drill_results, benchmarks, wow_maps.
- Seeds: ≥40 drills (§5.10 structure), ≥10 plans, WoW directory (codes marked with verify dates).
- Routes: `/training` academy, daily plan generator (5–60 min), session tracking, weekly report.

## Phase 5 — Control Studio

- Migrations: control_layouts, control_elements, control_positions, control_analysis,
  control_test_results.
- Visual HUD editor (original assets only), ergonomic analysis + heat map, layout test drills,
  sharing with version history.

## Phase 6 — Community + verification

- Migrations: posts, comments, reactions, reports, moderation_actions, reputation_events,
  correction_requests, creator_profiles, creator_content.
- Moderated posts/Q&A, report → moderator queue, creator portal, pro-vault corrections. MODERATION.md.

## Phase 7 — AI Coach

- Migrations: video_uploads, analysis_jobs, video_observations, coaching_reports,
  coaching_recommendations.
- Signed resumable uploads → idempotent background jobs (never request handlers) → ffmpeg keyframes
  → provider-abstracted vision model (Anthropic default, model IDs from config) → two-pass analysis
  → timestamped report (§5.13 format) with confidence + human-review tools. Cost guardrails +
  quotas. Post-match only — no live assistance, ever.

## Phase 8 — Billing + marketplace

- subscriptions (real), entitlements service (no scattered plan checks), Stripe webhooks,
  coach_profiles, coach_services, bookings, coach_reviews, marketplace_orders, payouts, disputes.

## Phase 9 — Native mobile

- `apps/mobile` Expo sharing types/tokens/API; push, offline, uploads, deep links.

## Hard rules that apply to every phase

No gameplay automation/overlays/live assistance · no fabricated stats/codes/settings · never
"zero recoil" · no PUBG-copyrighted assets · no secrets client-side · RLS on every user-owned
table · AI via provider abstraction with persisted model ID/prompt version/confidence ·
entitlements not plan checks · video work in idempotent background jobs.
