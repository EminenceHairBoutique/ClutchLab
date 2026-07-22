# SETUP

## Prerequisites

- Node 22+ (`.nvmrc`), pnpm 10 (`corepack enable`)
- For RLS integration tests: either PostgreSQL server binaries on the machine
  (`initdb`/`pg_ctl`, e.g. `apt install postgresql-16`) or a throwaway Postgres via
  `TEST_DATABASE_URL`

## Quick start (no credentials)

```bash
pnpm install
pnpm dev            # http://localhost:3000 — auth runs in visible MOCK mode
pnpm lint && pnpm typecheck && pnpm test
APP_ENV=test pnpm build && APP_ENV=test pnpm e2e
```

Without Supabase env vars the app boots in **mock auth mode**: a banner is shown, accounts and
profile data live in server memory, and production builds refuse this mode outright. That is the
spec §0.1.7 honest-placeholder path, not a simulation of completeness.

## Connecting real Supabase (removes mock mode)

1. Create a project at supabase.com.
2. Copy `.env.example` → `.env`; fill `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and `DATABASE_URL`
   (dashboard → Database → Connection string; use the session pooler URI locally).
3. Apply schema + seeds:
   ```bash
   pnpm db:migrate   # applies supabase/migrations/*.sql, tracked in _clutchlab.migrations
   pnpm db:seed      # roles, permissions, device knowledge base (idempotent)
   ```
   Equivalent for CLI users: `supabase link && supabase db push`.
4. Restart `pnpm dev` — the mock banner disappears; signup/login run against Supabase.
5. Auth settings in the dashboard:
   - Site URL: your `NEXT_PUBLIC_APP_URL`; add `/auth/callback` to redirect URLs.
   - Enable Google/Apple providers if wanted, then set `NEXT_PUBLIC_AUTH_GOOGLE=1` /
     `NEXT_PUBLIC_AUTH_APPLE=1`.
6. Roles: grants are service-role only by design (no client path, RLS-tested). Bootstrap your
   first admin in the SQL editor:
   ```sql
   insert into public.user_roles (user_id, role_slug)
   values ('<auth.users.id>', 'super_admin');
   ```

## Regenerating database types

`packages/types/src/database.ts` is hand-authored to match the migrations. With a linked
Supabase project, regenerate instead:

```bash
supabase gen types typescript --linked > packages/types/src/database.ts
```

## AI coach provider + worker

Without `ANTHROPIC_API_KEY`, the coach runs the clearly-labeled mock provider (dev/test only —
the worker refuses mock in production). To go real:

1. Set `ANTHROPIC_API_KEY` **and** `AI_COACH_MODEL` (model IDs live in config, never code).
2. Create a private `recordings` Storage bucket (signed-URL uploads; path `<user_id>/<upload_id>.mp4`).
3. Run the queue worker on a schedule:
   `DATABASE_URL=... pnpm --filter @clutchlab/coach worker`
   (bundle ffmpeg in the worker image for keyframe extraction — see `AI_COACH.md`).

## Error monitoring

Set `SENTRY_DSN` + `NEXT_PUBLIC_SENTRY_DSN`. Without them Sentry code stays dormant (and mostly
unshipped). Source-map upload is intentionally not wired yet — add `withSentryConfig` +
`SENTRY_AUTH_TOKEN` when a Sentry org exists.

## Test details

- `pnpm test` = unit/component suites + **RLS integration tests** that boot a throwaway local
  Postgres cluster (auto-drops to the `postgres` system user when run as root), apply
  `supabase/tests/harness/auth_shim.sql` + the real migrations + seed, and assert policy behavior
  through `anon`/`authenticated`/`service_role`. Set `TEST_DATABASE_URL` to use an external
  throwaway database instead (CI does this with a `postgres:16` service container).
- `pnpm e2e` = Playwright route smoke + mock-mode auth flows. Uses the preinstalled Chromium at
  `/opt/pw-browsers/chromium` when present; otherwise run
  `pnpm --filter @clutchlab/web exec playwright install chromium` once.

## Current credential blockers

Tracked with unblocking steps in `PROGRESS.md`: Supabase project (+ `recordings` Storage bucket),
Google/Apple OAuth, Anthropic API key + model, Sentry DSN, Stripe (Phase 8).
