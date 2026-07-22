# ClutchLab Mobile (Expo)

`apps/mobile` — the Phase 9 native app. Reader-first MVP that shares the monorepo's content
catalog, types, and design tokens. Nothing here contradicts the product's hard rules: no
gameplay automation, no overlays, no live-match anything — the app reads, links, and (once
credentials exist) uploads recordings after the match.

## What ships now vs. what needs credentials

| Capability (spec §20 Phase 9) | Status |
|---|---|
| Expo app | ✅ SDK 57, TypeScript strict, four-tab reader (Home / Meta / Train / More) |
| Shared API/types/design tokens | ✅ `@clutchlab/content` catalog + `@clutchlab/types` + `@clutchlab/ui/tokens` (drift-guarded against the web CSS theme by a unit test) |
| Offline access | ✅ by construction — reader screens consume the bundled editorial baseline (identical to the DB seed), so they work with no connection. Account data sync is part of the sign-in milestone below. |
| Deep links | ✅ `clutchlab://<tab>` scheme + `https://clutchlab.app/...` app links (Android intent filter + iOS associated domains once the domain is live). `src/lib/deeplink.ts` maps web paths to tabs; unit-tested. |
| Push notifications | 🔒 interface documented below; needs EAS project + push credentials |
| Uploads | 🔒 reuses the web's signed-URL flow; needs Supabase creds + mobile auth |

## Verification in this environment

No device or native SDKs exist in the build sandbox, so the honest gate is:

```sh
pnpm --filter @clutchlab/mobile lint        # eslint (shared flat config)
pnpm --filter @clutchlab/mobile typecheck   # tsc strict
pnpm --filter @clutchlab/mobile test        # deep-link + content-selector units
pnpm --filter @clutchlab/mobile build       # expo export: Metro-bundles ios+android (Hermes)
```

`expo export` compiles the full app + workspace deps through Metro — import errors, RN/JSX
mistakes, and workspace resolution problems fail the build. On-device behavior still needs
`npx expo start` with Expo Go (or a dev build) on real hardware — first thing to do outside
the sandbox.

## Navigation decision

Four tabs on local state + `expo-linking`, deliberately no navigation library yet (D30 in
PROGRESS.md): the reader MVP has a flat screen graph, and every native-module dependency we
avoid is one less unverifiable moving part in this environment. Graduate to `expo-router`
when detail screens/param routes arrive — `tabForUrl()` already isolates the mapping.

## Milestone: sign-in + account features

1. Add `@supabase/supabase-js` with `AsyncStorage` session persistence (Expo SecureStore for
   tokens); same `NEXT_PUBLIC_SUPABASE_*` project as the web.
2. Read paths mirror the web stores (RLS does authorization); mutations reuse the same
   server actions via the web where flows are complex (billing → Stripe checkout in a
   browser sheet; coach uploads → signed-URL PUT from the device).
3. Recording uploads: `video_uploads` register → `createSignedUploadUrl` → resumable PUT →
   `markUploaded` → `requestAnalysis`. All server pieces exist (see AI_COACH.md).

## Milestone: push notifications (§5.18)

1. `expo-notifications` + EAS project (`extra.eas.projectId` in app.json), APNs key +
   FCM credentials.
2. Store Expo push tokens in the `push_subscriptions` table (schema arrives with the
   notifications slice; §9 lists it) keyed by user + device, deleted on sign-out.
3. Preferences stay granular and opt-in (§5.18 list) — the server only sends what the user
   ticked; nothing is on by default. The More tab already states this contract.

## App identity

- Scheme `clutchlab`, bundle/package `app.clutchlab.mobile`, dark-first UI
  (`#0a0b0d` background everywhere).
- No copyrighted PUBG Mobile assets in the binary: no game screenshots, logos, maps, or
  audio. Icon/splash to be produced as original artwork before store submission.
