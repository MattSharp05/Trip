# Technical Design — Trip
Status: Approved 2026-10-06; v2 Group trips section in review 2026-10-09 · PRD: https://app.notion.com/p/3f124983f3ca81b4be8dd2226fdb12a1 · Design: [`design.md`](design.md)

Hard constraints from the PRD: iPhone only, **$0 running cost**, and everything must run in
**Expo Go** during the demo phase (no paid Apple account, no Mac, no custom native code).

## Stack
| Area | Choice | Why |
|---|---|---|
| App | **Expo SDK 57** (React Native, TypeScript strict) | Latest SDK that Expo Go on the App Store runs; one codebase; cloud builds later (ADR 0001) |
| Navigation | **Expo Router** with `unstable-native-tabs` | File-based routes; the native iOS tab bar (Liquid Glass on iOS 26), included in Expo Go |
| Icons / images | `expo-symbols` (SF Symbols), `expo-image` | Native icons per `design.md`; cached images |
| Sheets, gestures, motion | `@gorhom/bottom-sheet`, `react-native-gesture-handler`, `react-native-reanimated` | Itinerary sheet over the map, drag to reorder; all in Expo Go |
| City map | `react-native-maps` (Apple Maps, dark), decided by the TR-5 spike (ADR 0002) | Free, no key, native gestures, in Expo Go |
| Flight globe | `react-native-maps` flyover globe (`hybridFlyover`), geodesic arc as a polyline, plane marker (ADR 0002) | Free, no key, same native map as the city map; no WebView |
| Server state | TanStack Query | Caching, retries, optimistic updates (Smart Add undo) |
| UI state | Zustand | Selected trip/day/item shared by map and list |
| Backend | **Supabase free**: Postgres + RLS, Auth, Storage, Edge Functions (Deno) | One free service for accounts, data, files and server code (ADR 0003) |
| Import AI | **Gemini Flash free tier**, called only from an Edge Function, behind a `ParseProvider` switch | $0 now, Claude in Phase B by config (ADR 0004) |
| Events | Ticketmaster Discovery API (free key) via Edge Function `events` (ADR 0018) | Real events by location and date |
| Weather | Open-Meteo forecast (no key) | Free; forecast covers ~16 days, beyond that the pills show no weather |
| Currency | Frankfurter (ECB rates, no key), cached daily | Free |
| Place search / geocoding | Photon (komoot, OSM data, no key) via Edge Function | Free; Edge Function adds caching and a proper User-Agent |
| Photos | Unsplash API (free key) for trip covers, Wikimedia for landmarks, Ticketmaster images for events | Free with attribution |
| Flight status | Free tier of a flight-status API (AeroDataBox via RapidAPI, ADR 0017), day-of-flight only | Free tier allowance is small |
| TikTok / Reels | TikTok oEmbed (public) and page metadata via Edge Function → Gemini extracts places → Photon geocodes | No scraping; uses what a shared link exposes |
| Tests | Jest (`jest-expo`) + React Native Testing Library; Maestro on an EAS iOS simulator build | Unit/component on Linux CI; on-device flows on GitHub's macOS runner (ADR 0005, 0015) |
| Delivery | **EAS Update** to the `main` channel on every merge | Matthew opens the latest `main` in Expo Go; no per-PR previews (batched QA) |

Free-tier limits to remember: Supabase pauses a project after ~1 week without activity (keep-alive
Action), 500 MB database, 1 GB storage; Gemini free tier is roughly 10–15 requests/minute and a few
hundred per day; free-tier prompts may be used by Google to improve its products, so **passport and
visa images never go to AI**.

## Architecture
```
 iPhone (Expo Go)                                  Supabase (free)
 ┌───────────────────────────────┐                 ┌──────────────────────────────┐
 │ app/ (Expo Router screens)    │                 │ Postgres + RLS (per user)    │
 │  Trips · Plan · Organize ·    │  supabase-js    │ Auth (email+password, Google)│
 │  Discover · Settings · /dev   │ ───────────────▶│ Storage (originals, photos)  │
 │ features/* (UI + hooks)       │                 │ Edge Functions:              │
 │ core/* (pure TS, no RN):      │  functions.     │  parse-booking  → Gemini     │
 │  smartAdd, travel, dates,     │  invoke()       │  parse-link     → oEmbed+Gem │
 │  money, flights, scenarios    │ ───────────────▶│  events         → Ticketmaster│
 │ services/* (api clients)      │                 │  places         → Photon      │
 └───────────────────────────────┘                 │  flight-status  → free API    │
   direct, no key: Open-Meteo, Frankfurter,        │  photos         → Unsplash    │
   Apple Maps (react-native-maps)                  └──────────────────────────────┘
```
- **Every third-party key lives in Edge Function secrets**, never in the app bundle. The app only
  holds the Supabase URL and anon key (public by design; RLS protects data).
- **`core/` is pure TypeScript** (no React Native imports), so Smart Add, travel estimates, date and
  currency logic are unit-tested fast on CI.
- Map and list share one selection store (`selectedTripId`, `selectedDay`, `selectedItemId`). Tapping
  a row sets the item → the map flies to its pin; tapping a pin sets the item → the list scrolls to it.
- Booking import is one pipeline: pick file → upload original to Storage → `parse-booking` returns
  typed JSON (Zod-validated) → review screen → save creates the `booking`, its `itinerary_item`(s), a
  geocoded `place`, and an `expense` if there's a price. One write path, so wallet, plan, map and
  budget never disagree.
- TikTok and Reel links (ADR 0019): copied link (read only after a tap) → `parse-link` (oEmbed
  caption → `ParseProvider` → Photon near the trip) → results sheet → save creates the `place`s, a
  `saved_links` row and `bucket_items` pointing at it.

## Project structure
```
app/                      Expo Router routes
  (tabs)/_layout.tsx      NativeTabs: trips, plan, organize, discover
  (tabs)/trips/ …  (tabs)/plan/ …  (tabs)/organize/ …  (tabs)/discover/ …
  settings/ …  dev/ …     dev = scenario index (hidden outside dev/QA)
  auth/ …
src/
  core/                   pure TS + unit tests (smartAdd, travel, dates, money, flights, parse schemas)
  features/<feature>/     components + hooks per feature (plan, wallet, budget, bucket, discover, trips, auth)
  ui/                     design-system components (Surface, Chip, Segmented, Button, Skeleton, Text, Icon)
  theme/                  tokens (colors, spacing, radii, type scale)
  services/               supabase client, query keys, api wrappers
  scenarios/              scenario definitions + fixtures (sample Vegas trip)
  stores/                 zustand stores
supabase/
  migrations/             SQL, applied via the Management API
  functions/<name>/       Edge Functions
maestro/                  on-device flows
docs/                     TDD, decisions, design
```
Feature folders keep parallel tickets from touching the same files; shared screens compose features
through small registries (e.g. the wallet card renderer map by booking type) rather than one big file.

## Data & state
Tables (v1: all with `user_id` and RLS `user_id = auth.uid()`; v2 moves trip data to membership, see [v2: Group trips](#v2-group-trips)):
- `trips` (city, country, lat/lng, timezone, start/end date, cover photo)
- `places` (name, address, lat/lng, kind, photo url, source url)
- `itinerary_items` (trip, day date, start time local, duration, place, kind, booking?, fixed?)
- `bookings` (trip, type flight/hotel/car/ticket/reservation, structured JSON, original file path)
- `documents` (type passport/visa, country, expiry, image path) — not trip-scoped, never parsed by AI
- `bucket_items` (trip, place, window start/end, duration, source, fixed date/time and title for events)
- `expenses` (trip, amount, currency, category, booking?, paid at)
- `saved_links` (url, platform, title, thumbnail, extracted place ids) — also feeds Discover's
  "Saved from TikTok & Reels" row in aggregate
Times are stored as local wall-clock time plus the trip's IANA timezone (PRD: destination local
time); flights store each airport's local time and timezone.

Client: TanStack Query caches per trip; Zustand holds selection and UI state. Online only (PRD).

## Scenario system
- Scenarios are named fixtures in `src/scenarios/` (e.g. `vegas-day-3`, `vegas-flight-day`,
  `bucket-smart-add`, `import-review-flight`, `wallet-boarding-pass`, `budget-eur`) that load a
  deterministic sample trip into a **local demo session** (no Supabase writes), with a fixed "today".
- Opened by deep link: `exp://u.expo.dev/<project-id>/--/scenario/<name>?channel-name=main` in Expo
  Go (and `trip://scenario/<name>` once there's a standalone build), or from the `/dev` index screen
  reached via Settings → Developer.
- The same scenario names drive Maestro flows and the QA links on tickets.
- Hidden and disabled for signed-in real accounts outside dev/QA builds (`EXPO_PUBLIC_SCENARIOS`).

## Testing strategy
- **Unit (Jest):** everything in `core/` (Smart Add placement rules, travel estimates, date/timezone
  maths, currency conversion, parse-schema validation), Edge Function handlers (Deno test).
- **Component (RN Testing Library):** screens render from scenario fixtures; map ↔ list selection
  logic through the store.
- **On-device (Maestro, iOS simulator build from EAS; ADR 0015):** key flows per scenario, screenshots for QA media.
  Simulator builds need no paid Apple account. Runs on `main` only (build minutes are limited on the
  free plan); tagged flows can be run for a PR on demand.
- **Import accuracy (golden set; ADR 0020):** 12 made-up bookings scored field by field by
  `scripts/parse-accuracy.mjs` (`docs/parse-accuracy.md`). Live through `parse-booking` on demand
  (GitHub → Actions → Parse accuracy); the scorer on canned answers in Jest on every PR.
- **Real phone:** Matthew's iPhone in Expo Go is the QA of record (Kart Racer lesson).
- **Visual:** none automated at first; Maestro screenshots attached to tickets.
- **CI pipeline (GitHub Actions), two levels:**
  - PR gate (each job ≤ 5 min, in parallel): lint + typecheck + `expo-doctor`; Jest unit/component;
    Deno tests for changed functions; a "what changed" job skips JS jobs for docs-only PRs.
  - On `main`: the full Jest suite, `eas update --branch main` (QA link), Supabase migrations +
    function deploys when `supabase/` changed; Maestro flows in a separate `E2E` workflow.

## Environments & deploy
- **Local/QA:** Expo Go on Matthew's iPhone, opening the `main` EAS Update channel (link on the
  Notion project page). No per-PR previews (batched QA).
- **Backend:** one Supabase project (`wghftsubdrkxfzysovou`). Migrations and function deploys go
  through the Supabase Management API with `SUPABASE_ACCESS_TOKEN` (cloud sessions only reach HTTPS).
- **Secrets:** Claude environment variables `EXPO_TOKEN`, `SUPABASE_ACCESS_TOKEN`,
  `SUPABASE_PROJECT_REF`; third-party keys (Gemini, Ticketmaster, Unsplash, flight status) added as
  environment variables when their ticket starts, then stored as Supabase function secrets. GitHub
  Actions secrets: `EXPO_TOKEN`, `SUPABASE_ACCESS_TOKEN`.
- **Keep-alive:** a scheduled GitHub Action pings the database every 3 days with the anon key.
- **Phase B:** the same app builds with EAS for TestFlight on the company account; native extras
  (share extension, widgets, Live Activities) arrive as config plugins and targets then.

## Conventions
- TypeScript strict; ESLint (expo config) + Prettier; no default exports outside `app/`.
- Colours, spacing and radii only from `src/theme` tokens; icons only via the `Icon` wrapper over
  SF Symbols. Copy follows `design.md` (no emoji, no em dashes).
- Every network call goes through `services/` and TanStack Query; every loading state renders a
  `Skeleton`.
- Dates via `date-fns` + `date-fns-tz`; money as integer minor units + ISO currency code.
- Conventional Commits with the ticket ID; branches `tr-<n>/<slug>`.

## Risks & open questions
1. **Map look in Expo Go** (highest): Apple Maps via `react-native-maps` can't be restyled much
   (dark mode, POI filtering only). If it can't get close to the mockup, the fallback is MapLibre in
   a WebView for the city map too, at some cost in gesture feel. → **TR map spike first**, judged on
   the phone at the Plan checkpoint.
2. **Google sign-in in Expo Go** goes through a browser OAuth redirect to an `exp://` URL; fiddly but
   free. Own ticket after email sign-in.
3. **Gemini free-tier limits** (a few hundred requests a day) are fine for a demo; parsing quality
   on unusual bookings is measured on a sample set (≥ 90% fields correct, PRD).
4. **Instagram links** expose less metadata than TikTok without an app review; Reels may fall back to
   "type the place".
5. **Travel times** are estimates (straight-line distance × 1.3, walking 4.8 km/h, driving above
   ~1.6 km); a routing API is a later upgrade. Good enough for Smart Add ordering in the demo.
6. **Free-tier terms:** Open-Meteo's free API is for non-commercial use (fine for the demo, revisit
   in Phase B); Photon and OpenFreeMap are fair-use public services.
7. **Expo Go tracks the latest SDK only:** when Expo ships SDK 58 to the App Store, the project must
   upgrade (a planned ticket when it happens).

## v2: Group trips
PRD: project page → "v2: Group trips". Same constraints: $0, Expo Go only, no Phase B features.
ADRs 0027–0032.

### Data model (ADR 0027, 0029, 0030)
| Table / change | Purpose |
|---|---|
| `profiles` (id, display_name, venmo, cashapp, zelle) | Names on avatars and "Added by"; payment handles. Readable by yourself and co-members |
| `trip_members` (trip_id, user_id, role owner/member, joined_at) | Membership; creator added by trigger; existing trips backfilled |
| `is_trip_member(trip)` (security definer) | Used by every trip-scoped policy |
| `trip_invites` (token, trip_id, created_by, revoked_at) + `invite_preview`, `accept_invite` RPCs | Invite links |
| `places.trip_id`; plain FKs + same-trip triggers instead of composite `(x_id, user_id)` FKs | Members can attach to each other's rows on the same trip |
| `user_id` = added by; `itinerary_items.added_by` | Attribution, kept when a Bucket List item is planned |
| `bucket_likes` (bucket_item_id, user_id) | Likes, "Popular" |
| `item_opt_outs` (itinerary_item_id, user_id) | Everyone is in unless they opt out |
| `bookings.visibility` shared/private; `trip_flights(trip)` | Mine / Shared; flight times visible to the group, passes private |
| `document_shares` (document_id, trip_id) | Share a passport/visa with one trip |
| `trips.currency`; `expenses.paid_by, itinerary_item_id, rate_to_trip, trip_currency`; `expense_shares` | Shared expenses (equal split, stored shares) |
| `payments` (from, to, amount, currency, method) | Settled payments |
| `payment_nudges` | In-app reminders, one per pair per day |

Migrations are named after their ticket (`0050_group_trips.sql`), are additive, and keep the app
on `main` working (builders apply from their branch to the one project). `db:test-rls` covers
owner / member / non-member and private items for every new table.

### App
- **Data layer split first** (Foundations ticket): `src/services/data/` becomes one module per
  domain (`trips`, `members`, `itinerary`, `bucket`, `bookings`, `documents`, `expenses`), each with
  its slice of the `DataSource` interface, demo implementation, Supabase implementation, hooks and
  tests, composed in `source.ts` / `index.ts`. Parallel tickets then touch different files.
- **Members:** `useTripMembers(tripId)` returns `{ id, name, initial, role, isMe }[]`. Avatars are
  initials in a 24 pt circle (Surface fill, white initial; the selected or "you" ring in orange),
  per `design.md` (no photos, no colours beyond the tokens).
- **Live updates** (ADR 0028): `useTripLiveUpdates(tripId)` subscribes to `postgres_changes` for the
  open trip and invalidates its queries.
- **Invites** (ADR 0029): `app/invite/[token].tsx` outside the auth guard; share via `Share`.
- **Opening a trip** always lands on Plan with the map (cards, globe, switcher, join).
- **Flights:** `trip_flights` feeds an Arrivals list (grouped by airport, sorted by landing time)
  and, on the arrival day, one great-circle arc per traveler converging on the destination
  (`src/core/flights.ts` already draws one).
- **Bucket List:** "Added by" line, heart + count, Popular sort; "Suggest times" runs Smart Add's
  scorer (ADR 0006) for liked items and shows a proposed slot per item to accept.
- **Itinerary:** row shows who is going (avatars) and "Added by"; the detail sheet has "I'm out".
- **Wallet:** Organize → `Mine | Shared` segmented control above the filter chips; each item's menu
  has Share with group / Make private (owner only). Other members' items show "Added by".
- **Money:** Organize's Budget becomes **Expenses** (list + add) and **Balances** (one row per
  member, person detail with history, Pay with Venmo / Cash App, Zelle details, Mark as paid,
  Send reminder). Pure logic in `src/core/split.ts`, `src/core/settle.ts`,
  `src/core/paymentLinks.ts`.

### Scenarios (decision 8)
Pretend travelers **Blake** and **Willem** join the Vegas fixtures (`src/scenarios/fixtures/group.ts`):
three flights converging on LAS (Matthew from LAX, Blake from ORD, Willem from JFK), likes on
Bucket List items, an opt-out, expenses in USD and EUR, one payment, one reminder. The demo
session plays "you" = Matthew; scenario names start with `group-` (e.g. `group-plan-arrivals`,
`group-bucket-popular`, `group-balances`). Real two-account checks use Matthew's phone plus a
second account (a second sign-up) for invites and live updates.

### Reachability (checked 2026-10-09 from a cloud session)
Supabase Realtime websocket (`wghftsubdrkxfzysovou.supabase.co/realtime/v1`, 401 without a key =
reachable), Frankfurter historical rates (`api.frankfurter.dev/v1/<date>`), Expo Push
(`exp.host`), `venmo.com`, `cash.app`: all reachable. No new domains to allow.

### v2 risks
1. **Remote push in Expo Go on iOS** is unproven: spike first; reminders work in-app regardless.
2. **RLS rewrite** touches every table on the live project: one migration, backfilled, tested by
   `db:test-rls` with three users before anything builds on it.
3. **Two-device QA:** invites and live updates need a second account; the scenarios cover the rest.
