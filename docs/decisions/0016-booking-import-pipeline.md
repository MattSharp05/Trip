# 0016 — Booking import: shared parse code, multi-file function deploys, geocoding in the function

**Context.** TR-25 builds booking import on ADR 0004 (Gemini Flash behind a `ParseProvider`,
shared Zod schemas). Three things weren't decided yet: how the Edge Function and the app share the
schemas (until now every function was one self-contained `index.ts`), where the imported places
get their coordinates, and how a restaurant reservation shows in the wallet, which has no
reservation type.

**Decision.**
- The schemas and the sample parses live in `supabase/functions/_shared/parse/`. The app imports
  them by relative path; `parse-booking` imports them with `.ts` extensions (Deno), which
  `tsconfig.json` allows (`allowImportingTsExtensions`). `scripts/supabase-functions.mjs` uploads
  each function's `index.ts` plus every file in `_shared/`, with an import map that resolves `zod`
  to `npm:zod@<the app's version>`.
- `parse-booking` geocodes what the model found (Photon, no key, the same service as `places`)
  before answering, so the app gets places with coordinates in one call. `places` stays a city
  search for "create a trip".
- `PARSE_PROVIDER=fixture` (a function secret) swaps Gemini for the canned sample parses; scenario
  demo sessions use the same samples in the app and never call the function.
- A reservation is saved as a `ticket` booking (the venue, the time, "Table for 2") with a `food`
  itinerary item; the wallet's Tickets filter already reads "Event tickets and reservations".

**Consequences.**
- Shared code changes redeploy every function (CI deploys all when `supabase/**` changes).
- A dedicated reservation card, if wanted later, is a new wallet type plus a data migration of
  those ticket rows.
