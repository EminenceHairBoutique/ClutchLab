# ClutchLab

Independent PUBG Mobile companion platform: verified pro settings, personalized sensitivity
calibration, versioned meta engine, training academy, and post-match AI coach.

**Authoritative spec: `ClutchLab_v3.md` (repo root). Read it in full before writing code.**
Section 0.1 defines the operating protocol; Section 20 the phases; Section 24 the execution loop.

## Session start

1. Read `PROGRESS.md` for current phase, decisions, and blockers.
2. Read the relevant spec sections for the phase you're resuming.
3. Continue from the next step in `PROGRESS.md` — do not restart completed work.

## Stack

pnpm workspaces monorepo. Next.js (App Router) · React · TypeScript strict · Tailwind v4 ·
shadcn/ui · Supabase (Postgres, Auth, Storage, RLS) · Stripe · Sentry. Expo app in Phase 9.

Next.js over a Vite SPA is deliberate — SEO/SSR requirements in spec §19. Don't relitigate it.

## Commands

| Task | Command |
|---|---|
| dev | `pnpm dev` |
| lint | `pnpm lint` |
| typecheck | `pnpm typecheck` |
| test | `pnpm test` |
| build | `pnpm build` |
| migrate | `pnpm db:migrate` |
| seed | `pnpm db:seed` |

## Hard rules

- **No gameplay automation.** No macros, overlays, injected code, or live-match assistance.
  Analysis is post-match only, on user-uploaded recordings. This is a product-defining constraint.
- **No fabricated data.** Never invent weapon stats, sensitivity codes, pro settings, or patch
  notes. Unverifiable data is stored with `sample` or `unverified` status in the database, not
  just labeled in the UI. Every time-sensitive record carries source, date, version, confidence.
- **Never claim "zero recoil"** or guaranteed outcomes anywhere in code, copy, or seed content.
- **No copyrighted PUBG Mobile assets** — no game screenshots, maps, weapon renders, logos, audio.
- **No secrets in the client.** Service-role keys server-side only. `.env` gitignored,
  `.env.example` complete and current.
- **RLS on every user-owned table.** Permissions are server-authoritative; never trust client role
  claims.

## Definition of done (per phase)

`pnpm lint` → `pnpm typecheck` → `pnpm test` → `pnpm build` must all pass, plus new routes render
without console errors. Then update `PROGRESS.md`, then commit. Never mark a phase done on a
failing gate; never report a mocked feature as complete.

## Conventions

- Strict TypeScript. No `any`, no non-null `!` to silence the compiler, no swallowed errors.
- Zod-validate all external input: request bodies, env vars, AI responses, uploaded metadata.
- AI access goes through the provider abstraction only. Model IDs come from config, never
  hard-coded. Every AI output persists model ID, prompt version, and confidence.
- Entitlements gate paid features — never scattered `plan === 'pro'` checks.
- Video processing runs in background jobs, never in a request handler. Jobs must be idempotent.
- Small, coherent commits: `feat(meta): version-scoped weapon tier engine`.

## Working style

Make reasonable decisions autonomously and log them in `PROGRESS.md` rather than pausing for
approval. Ask only when a choice is irreversible, costly, or contradicts the spec. When blocked by
a credential or external service, build the real interface plus a named `*.mock.ts` adapter,
document the swap-in in `SETUP.md`, and record the blocker — don't abandon the feature.
