# Trip

An iPhone travel app with three concepts: **Organize** (a wallet that turns bookings into clear
cards), **Plan** (a big interactive map with the itinerary underneath, plus a Bucket List and Smart
Add) and **Discover** (events on your dates for every upcoming trip). AI works out of sight: it
reads bookings and TikToks. The demo phase costs $0 and runs in Expo Go; if Matthew's company
approves it, Phase B moves to their Apple developer account (TestFlight, share sheet, widgets,
Live Activities). The PRD on the Notion project page is the source of truth for scope.

Design: follow `docs/design.md` (rules) and `docs/design/reference-mockup.webp` (look).

## Workflow
Follows the `dev-workflow` skill (ticket-driven: Notion → branch → PR → QA → merge).
- Notion project page: https://app.notion.com/p/3f124983f3ca81b4be8dd2226fdb12a1
- Tickets data source: collection://3627b61b-ada0-45e8-a69e-2cb41034b942   (ID prefix: TR)
- Epics data source: collection://863c0317-6a10-4e3d-a94d-4391a87359fa
- GitHub: MattSharp05/Trip
- Preview URLs: batched QA mode, so no per-PR previews. QA happens in Expo Go on the latest `main`.
- QA link (latest `main` in Expo Go): `exp://u.expo.dev/0458c1dd-61a0-47f7-ac52-c648b4458fea?runtime-version=exposdk:57.0.0&channel-name=main`
  (QR: https://qr.expo.dev/eas-update?slug=exp&projectId=0458c1dd-61a0-47f7-ac52-c648b4458fea&runtimeVersion=exposdk:57.0.0&channel=main,
  or expo.dev → project `matthew` → Updates → branch `main`). Change `exposdk:57.0.0` on an SDK upgrade.
- CI: `.github/workflows/ci.yml`. PRs: lint + format + typecheck + expo-doctor, and Jest (skipped
  for docs-only PRs). Push to `main`: same checks, then `eas update --branch main` (needs the
  `EXPO_TOKEN` repo secret).
- QA mode: batched (batch ends at ⭐ checkpoint waves)
- Parallel builders: 2 (a 3rd only when Files touched are clearly separate)
- Approval: standing (every planned ticket pre-approved; stop only at ⭐ checkpoints and blocks)
- Merge policy: fast. When `main` moved after a PR's CI went green (no conflict): merge now;
  main's full suite checks the combination and a red main is reverted.
- Expo project ID: 0458c1dd-61a0-47f7-ac52-c648b4458fea (`eas init --id …`)
- Supabase project ref: wghftsubdrkxfzysovou

## Stack
See `docs/TDD.md` (approved) and `docs/decisions/`. In short: Expo SDK 57 + TypeScript strict,
Expo Router with native tabs, **Expo Go compatible only** (no custom native code until Phase B);
Supabase free (Postgres + RLS, Auth, Storage, Edge Functions holding every third-party key);
Gemini Flash free tier behind a `ParseProvider` switch; map per the TR map spike (ADR 0002);
TanStack Query + Zustand; Jest + RN Testing Library; Maestro on EAS (simulator) on `main`;
EAS Update to the `main` channel on every merge.

## Commands
Node 22 (`.nvmrc`), npm (`package-lock.json`). Add packages with `npx expo install <pkg>` (SDK-matched versions).
- `npm start` — Expo dev server (open in Expo Go)
- `npm run lint` — ESLint (expo config + Prettier compat)
- `npm run typecheck` — `tsc --noEmit` (strict)
- `npm test` — Jest (`jest-expo/ios` preset) + React Native Testing Library
- `npm run format` / `npm run format:check` — Prettier
- `npx expo-doctor` — dependency/config check (must report no issues)
- `npx expo export --platform ios` — proves the bundle builds
- Never `expo prebuild` (no `ios/`; ADR 0001).
- Supabase (needs `SUPABASE_ACCESS_TOKEN`; Management API only, no direct Postgres):
  `npm run db:apply` applies new `supabase/migrations/*.sql` + `supabase/auth.json` (never edit an
  applied migration; add a new one), `npm run db:types` also regenerates
  `src/services/database.types.ts`, `npm run db:test-rls` runs the two-user RLS test. CI on `main`
  runs apply + RLS test when `supabase/**` changed.

## Structure
See [TDD → Project structure](docs/TDD.md#project-structure).
- `app/` — Expo Router routes only. `app/(tabs)/_layout.tsx` is the native tab bar (Trips, Plan,
  Organize, Discover); each tab is a folder with its own Stack.
- `src/core/` — pure TypeScript, no React Native imports (tab config, later Smart Add, dates, money).
- `src/features/<feature>/`, `src/ui/`, `src/theme/`, `src/services/`, `src/scenarios/`, `src/stores/`.
- `supabase/` (migrations, Edge Functions), `maestro/` (on-device flows), `docs/`.
- Import from `src/` with the `@/` alias (`@/core/tabs`).

## Conventions
See [TDD → Conventions](docs/TDD.md#conventions).
- TypeScript strict; ESLint + Prettier (single quotes, width 100). Named exports only in `src/`
  (lint-enforced); default exports only for routes in `app/`.
- Expo Go only: every dependency with native code must be in the SDK's bundled modules (a Jest test
  enforces it). New libraries or services need an ADR.
- Colours, spacing, radii only from `src/theme`; icons via SF Symbols; copy per `docs/design.md`.
- Network calls through `src/services/` + TanStack Query; dates via `date-fns`(`-tz`); money in
  integer minor units.
- Conventional Commits with the ticket ID (`feat(plan): … [TR-12]`); branches `tr-<n>/<slug>`.

## Testing
See [TDD → Testing strategy](docs/TDD.md#testing-strategy).
- Unit tests sit next to the code (`src/core/*.test.ts`); route/app-level tests in `__tests__/`.
- Routes are tested with `renderRouter` from `expo-router/testing-library` (RNTL 13; v14's async
  render doesn't work with it yet).
- On-device: Maestro flows in `maestro/`, run on EAS on `main`.
- Scenario links use deep links (e.g. `trip://scenario/vegas-day-3`), disabled for real accounts.
