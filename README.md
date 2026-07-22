# ClutchLab

Independent PUBG Mobile companion platform: verified pro settings, personalized sensitivity
calibration, versioned meta engine, training academy, and post-match AI coaching.

**Not affiliated with, endorsed by, or connected to PUBG MOBILE, KRAFTON, Tencent Games, or
Level Infinite.** No gameplay automation of any kind — analysis is post-match only, on
recordings users upload themselves.

## Status

Phase 1 (foundation) complete: monorepo, design system, auth (Supabase + honest mock mode),
identity schema with RLS integration tests, core navigation, profile management, admin role
gate, CI, and error monitoring. See `PROGRESS.md` for the live phase ledger.

## Getting started

```bash
corepack enable && pnpm install
pnpm dev          # mock auth mode without credentials — see SETUP.md to connect Supabase
```

| Command | Purpose |
|---|---|
| `pnpm dev` | Dev server |
| `pnpm lint` / `pnpm typecheck` | Static checks |
| `pnpm test` | Unit + component + RLS integration tests |
| `APP_ENV=test pnpm build` | Production build without prod credentials |
| `APP_ENV=test pnpm e2e` | Playwright route + auth-flow smoke |
| `pnpm db:migrate` / `pnpm db:seed` | Apply schema/seeds to `DATABASE_URL` |

## Documentation

- `ClutchLab_v3.md` — authoritative product/build spec
- `PROGRESS.md` — phase ledger, decisions, blockers (read first when resuming)
- `IMPLEMENTATION_PLAN.md` — phase-by-phase execution map
- `SETUP.md` — environment + Supabase connection guide
- `ARCHITECTURE.md` — stack decisions and trade-offs
