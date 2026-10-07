# 0018 — Events on Discover: Ticketmaster Discovery API, cached in the function

**Context.** TR-31 fills Discover with "Happening in <city>": real events near the selected trip on
its dates, in the chips Events, Food, Nightlife and Sports. The TDD names the Ticketmaster Discovery
API (free key) behind an Edge Function. The demo must also work, deterministically, before any key
exists and in tests.

**Decision.**
- **Provider: Ticketmaster Discovery API v2** (`GET /discovery/v2/events.json`), free key from
  developer.ticketmaster.com: 5,000 calls a day, 5 a second, no card. HTTPS with the key as the
  `apikey` parameter, held as the function secret `TICKETMASTER_API_KEY` (ADR 0003). It has the
  best coverage of concerts, sports and shows in the US cities the demo uses, with images.
  Alternatives looked at: SeatGeek (needs approval for a client id), Eventbrite (no public search
  by location since 2020), PredictHQ (paid).
- **Edge Function `events`** (`supabase/functions/events/index.ts`; reusable code in
  `supabase/functions/_shared/events/`, because the deploy script ships each function's
  `index.ts` plus `_shared/**`): takes `{ lat, lng, startDate, endDate }` (local dates, at most
  31 days) and answers `{ events: TripEvent[] }` (shared Zod schema).
  - **Search:** the trip's centre as a geohash, 25 km radius, sorted by date, up to 3 pages of 100.
    The UTC window is a day wider each side; events are then kept by their **local** date, so the
    trip's first and last days are covered in any time zone. Cancelled events, repeats (one show
    listed per ticket type) and venues outside the radius are dropped.
  - **Categories:** segment Sports → Sports; a food or drink genre → Food; dance or electronic
    music, or any show at a nightclub, dayclub or lounge → Nightlife; everything else (concerts,
    theatre, comedy, family, film) → Events. Networking has no source yet (TR-34).
  - **Cache:** answers are kept in memory for 6 hours per area (5-character geohash, about 5 km)
    and dates, per function instance; the app's TanStack Query `staleTime` is also 6 hours. No
    cache table: the daily allowance is far above what a demo uses, so a cold instance asking again
    costs nothing that matters.
- **No key:** the function answers `not_configured` (503) and the app says "Event listings aren't
  set up yet." The rest of Discover (search, chips, Popular with travellers) still works.
- **Fixture mode.** `EVENTS_PROVIDER=fixture` answers deterministic Las Vegas events for Nov 12–16,
  2026 (`_shared/events/fixtures.ts`). Scenario demo sessions use the same fixtures in the app and
  never call the function (like ADR 0016 and 0017).
- **Saving.** `+` saves a bucket item with the event's name (`bucket_items.title`, migration 0007),
  its venue as the place (reused when the trip already has it) and the fixed date and time, so
  Smart Add (TR-29) keeps it at that time.

**Consequences.**
- No new app dependency; the function adds no npm package (Zod only).
- Ticketmaster's terms ask for attribution and linking to its event pages; each event keeps its
  `url` for the ticket link a later ticket can show.
- Changing provider is a new `EventsProvider` in the function; the app and the schema stay.
