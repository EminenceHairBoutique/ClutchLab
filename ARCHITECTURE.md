# ARCHITECTURE

Stack decisions for ClutchLab (spec §8). Phase 1 scope; grows with each phase.

## Framework: Next.js App Router — deliberately, not by default

Spec §19 requires structured, indexable pages (weapon pages, tier lists, patch notes, pro
profiles, guides) with canonicals, Open Graph, JSON-LD, sitemaps, and version-aware URLs. That is
a server-rendering problem: a Vite SPA would need a separate SSR/prerender layer bolted on to
avoid client-only HTML for crawlers. Next.js App Router gives SSR/SSG per route, dynamic
metadata, streaming, server actions (auth + mutations without API boilerplate), and middleware
(session refresh) in one model. **Do not relitigate this** (also pinned in CLAUDE.md).

## Monorepo

pnpm workspaces + Turborepo. Internal packages are **source-only** (no build step): `apps/web`
transpiles them via `transpilePackages`, vitest consumes TS directly. One less build graph to
maintain; Turbo still caches lint/typecheck/test per package.

```
apps/web              Next.js 15 App Router PWA (mobile-first, dark-first)
packages/config       Zod env validation + shared ESLint flat config
packages/types        Database types (hand-authored ↔ regenerable) + role constants
packages/ui           Tailwind v4 @theme tokens + shadcn-style components (vendored, no CLI)
packages/db           Migration/seed runner + local-Postgres RLS test harness
supabase/             Migrations (Supabase-compatible SQL), seed, test-only auth shim
```

Planned per spec §8.1: `apps/admin` (Phase 2), `packages/meta-engine` (2), `packages/calibration`
(3), `packages/analytics`, `packages/content`, `apps/mobile` (9).

## Environment model

`packages/config/src/env.ts` is the single source of truth. Three modes via `APP_ENV`
(fallback `NODE_ENV`):

- **production** — Supabase URL + anon key required, `AUTH_MOCK` forbidden. Enforced at server
  boot (`instrumentation.ts`) and at build for static pages. Fail fast, never limp mocked.
- **development / test** — Supabase optional. Absent (or `AUTH_MOCK=1`) ⇒ explicit mock-auth
  mode with a visible banner. CI builds declare `APP_ENV=test`.

## Auth

`AuthGateway` interface with two implementations selected server-side per request:

- `SupabaseAuthGateway` — `@supabase/ssr`: middleware refreshes sessions (RSCs can't write
  cookies), server actions handle credentials, `/auth/callback` completes PKCE (OAuth + email
  confirm). OAuth buttons render only when `NEXT_PUBLIC_AUTH_GOOGLE/APPLE` are set.
- `MockAuthGateway` + `MockAuthStore` (`auth.mock.ts`) — in-memory users/sessions/profiles.

Session-dependent pages (`/login`, `/signup`, `/profile`, `/admin`) are `force-dynamic`; auth
state is never baked into static HTML.

## Data + security model

- Supabase-compatible SQL migrations; RLS enabled on **every** table. Owner-scoped CRUD for
  user data; public read for reference data (devices, roles metadata); editor+ writes for the
  device KB; **no client-side path** to role grants, subscriptions, or audit logs (service role
  only).
- Role checks run in the database: `public.has_role_at_least()` is SECURITY DEFINER over a
  ranked role ladder (also avoids RLS recursion on `user_roles`). The app calls it via RPC under
  the caller's own session — client role claims are never trusted.
- App data access goes through the user-session Supabase client, so RLS applies to every query.
  The service-role key is reserved for server-side jobs/tooling (none shipped yet).
- Data integrity (spec §0.1.8): `data_status` enum (`verified|unverified|sample`) + source
  columns live in the schema. Seeds ship as `unverified`/`sample` — the RLS test suite asserts
  no seed row claims `verified`.

## Testing strategy

| Layer | Tool | What it proves |
|---|---|---|
| Env rules, schemas, stores | vitest (node) | Validation and mode selection logic |
| UI components, nav, forms | vitest + RTL (jsdom) | Render, a11y roles, IA completeness |
| **RLS policies** | vitest + real Postgres | The shipped SQL, via anon/authenticated/service_role |
| Routes + auth flows | Playwright (mobile viewport) | Every §4 route renders console-error-free; signup→profile→signout works |

The RLS harness boots a private cluster (`initdb`/`pg_ctl`, unix socket; drops to the `postgres`
system user when root) or uses `TEST_DATABASE_URL`, then applies a test-only `auth` shim followed
by the **unmodified** production migrations and seed.

## Design system

Tailwind v4 CSS-first tokens in `packages/ui/src/styles/theme.css` (spec §7.1): graphite
surfaces, one electric accent, tier colors S–F that always carry a letter label, system font
stacks (bundled variable font is a deliberate later swap — no network font fetch at build),
motion only to clarify (respects `prefers-reduced-motion`). Components are shadcn-style vendored
sources on Radix primitives — no generator CLI, fully owned.

## Observability

Sentry via `instrumentation.ts` (server, + `onRequestError`) and `instrumentation-client.ts`
(lazy). Entirely inert without DSNs. Source-map upload deferred until credentials exist.

## Known trade-offs (revisit later)

- Hand-authored `Database` types until `supabase gen types` can run against a linked project.
- Native `<select>` in forms (adequate, accessible); a styled Select lands with the design system
  growth in Phase 2–3.
- `apps/admin` deferred to Phase 2 — `/admin` in the web app currently proves the role gate only.
- Middleware bundle includes Sentry wrapping (~180 kB server-side) — acceptable; revisit if edge
  latency matters.
