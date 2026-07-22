# Deploying ClutchLab

The production site (`clutchlabv3.vercel.app`) deploys `apps/web` from this pnpm + Turborepo
monorepo. The single most important setting is the **Root Directory** — a repo that builds from
the wrong root is exactly why an earlier deploy failed.

## Vercel project settings (one-time)

1. **Framework Preset:** Next.js (auto-detected).
2. **Root Directory:** `apps/web`  ← **required.** Vercel walks up to the workspace root for
   `pnpm-workspace.yaml`, installs once, and builds the app. Leave *"Include files outside the
   root directory"* enabled (default for monorepos).
3. **Build Command / Install Command / Output:** leave as Vercel defaults
   (`next build` / `pnpm install` / `.next`). No turbo wrapper is needed at this level.
4. **Node.js Version:** 22.x (matches `engines.node`).
5. **Production Branch:** `main`.

`next.config.ts` sets security headers (nosniff, Referrer-Policy, X-Frame-Options,
Permissions-Policy) and a no-cache header for `/sw.js` — portable across Vercel and any Node host,
so they also apply under `next start`.

## Environment variables

Set these in Vercel → Settings → Environment Variables (Production). See `.env.example` for the
complete annotated list; the essentials:

| Variable | Needed for | Notes |
|---|---|---|
| `NEXT_PUBLIC_APP_URL` | canonical URLs, OG tags, sitemap, JSON-LD | e.g. `https://clutchlabv3.vercel.app` |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | real auth + data | **required in production** — without them the build fails fast (by design). |
| `SUPABASE_SERVICE_ROLE_KEY` | webhooks, notifications fan-out, worker | server-only; never exposed to the client. |
| `DATABASE_URL` | migrations/seed (not the app runtime) | use the **Session pooler** string (IPv4) — see below. |
| `ANTHROPIC_API_KEY` + `AI_COACH_MODEL` | real AI coaching | absent → clearly-labeled mock provider (non-prod only). |
| `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` + `STRIPE_PRICE_PRO` + `STRIPE_PRICE_ELITE` | real billing | absent → mock billing (non-prod only). |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` + `VAPID_PRIVATE_KEY` + `VAPID_SUBJECT` | web push | absent → in-app inbox still works. `npx web-push generate-vapid-keys`. |
| `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` | error monitoring | optional; dormant when empty. |

> Production env validation **refuses** mock auth/billing/coach — configure the real services or
> the build stops. That is intentional (no accidental mock in prod).

## Database migrate + seed (once per environment)

Run from a machine that can reach Supabase (this repo's sandbox could not — the direct DB host is
IPv6-only and raw-TCP:5432 is blocked by the egress proxy; use the **Session pooler** connection
string, which is IPv4):

```sh
export DATABASE_URL='postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres'
pnpm db:migrate   # applies migrations 0001–0009, idempotent, tracked in _clutchlab.migrations
pnpm db:seed      # roles/permissions/devices + generated content seed (publishes the meta snapshot)
```

Verify the snapshot went live:

```sql
select slug, status, published_at from public.meta_snapshots;  -- expect status 'published'
select count(*) from public.weapon_tiers;                      -- expect 50
```

Create a private **`recordings`** Storage bucket if you enable the AI coach uploads (see
`AI_COACH.md`).

## Post-deploy smoke check

- `/`, `/meta`, `/weapons/<slug>`, `/training`, `/coach`, `/pros`, `/community` render.
- `GET /manifest.webmanifest` returns standalone display + PNG icons; `GET /sw.js` returns the
  worker. On iPhone: Safari → Share → **Add to Home Screen** installs it standalone.
- View source on `/` shows the JSON-LD Organization/WebSite/SoftwareApplication graph; `/weapons/<slug>`
  adds TechArticle + BreadcrumbList.
- With Supabase configured, sign up → the mock-mode banner is gone and data persists.

## The two-codebase note

Historically `main` carried a flat single-app layout that no longer matched this monorepo and
likely failed to build. Replacing `main` with this branch fixes that — but **you must set Root
Directory to `apps/web`** (above) for the new layout to deploy. After merging, trigger a fresh
Production deployment and confirm the build logs show it building from `apps/web`.
