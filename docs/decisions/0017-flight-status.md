# 0017 — Live flight status: AeroDataBox through RapidAPI, cached and capped in the function

**Context.** TR-26 shows a booked flight's live status (On time, Delayed 25 min, Gate change,
Cancelled, Landed) on the day it flies. The TDD asks for a free-tier flight-status API, day of
flight only, with the key held by an Edge Function. Free allowances are small, so the function has
to call as rarely as possible and never run past the free plan.

**Decision.**
- **Provider: AeroDataBox via RapidAPI**, the free **Basic** plan: 400 API units a month, 1
  request a second, no card. We use one endpoint, "Flight Status (single day)"
  (`GET /flights/number/{number}/{date}?dateLocalRole=Departure`), a Tier 2 endpoint at 2 units a
  call, so the free plan is 200 lookups a month. HTTPS with the key in the `X-RapidAPI-Key` header,
  so it fits ADR 0003 (function secrets, no key in the app). It covers gates, terminals and revised
  times for the big US carriers, which is what the demo trips fly. Alternatives looked at:
  AviationStack's free plan is HTTP-only (no HTTPS) and FlightAware AeroAPI needs a card on file.
- **Edge Function `flight-status`** (`supabase/functions/flight-status/`): takes the booked flight
  (number, local departure date, departure airport, booked departure and arrival instants) and
  answers `{ status }` (shared Zod schema in `supabase/functions/_shared/flightStatus/`).
  - **Window:** it calls the provider only from 24 h before the booked departure to 2 h after the
    booked arrival (the 2 h lets a late flight's delay and "Landed" still show). Outside it:
    `outside_window`, and the app doesn't ask at all.
  - **Cache:** one row per flight and day in `flight_status_cache`; answers younger than 10 minutes
    are served from it. The app refreshes every 10 minutes while the flight is in its window.
  - **Allowance guard:** before each provider call the function reserves the call's units in
    `flight_status_usage` (one row per UTC month) with `reserve_flight_status_units`, which refuses
    once the month would pass 90% of the allowance (360 of 400 units). Then the function answers
    the last cached status, or `limit_reached`. Failed calls count too, so the guard never
    under-counts. `FLIGHT_STATUS_MONTHLY_UNITS` and `FLIGHT_STATUS_UNITS_PER_CALL` (optional
    secrets) adjust it if the plan changes.
  - Both tables are service-only (migration 0005: RLS on, no policies, no grants to `anon` or
    `authenticated`); the function reaches them with the service role key Supabase gives every
    function. The RLS test checks users and anonymous clients can't read, write or call them.
- **No key, no error UI.** Without `FLIGHT_STATUS_API_KEY` the function answers `not_configured`
  (503). The app treats every error the same way: no pill, the booked details. Status is extra
  information, never a blocker.
- **Fixture mode.** `FLIGHT_STATUS_PROVIDER=fixture` (a function secret) answers deterministic
  statuses without the provider or the counter. Scenario demo sessions use the same fixtures in
  the app and never call the function (like ADR 0016's sample parses): every flight in its window
  is on time, except in `vegas-flight-delayed`, where AA 2410 is 25 minutes late from gate E79.
- **What the app shows** (`src/features/wallet/flight/status.ts`): one pill, most important first:
  Cancelled, Diverted, Landed, Delayed (15 minutes or more, the US DOT on-time line), Gate change
  (the departure gate or terminal differs from the booked one), On time. On time is the semantic
  green; problems use the accent orange; Landed is grey. On the flight details the live gate and
  terminal replace the booked ones, with an "Updated" label.

**Consequences.**
- No new app dependency; the function adds no npm package (Zod only, as in ADR 0016).
- The free plan covers roughly 180 lookups a month after the 90% line: enough for a demo with a few
  travellers, since the cache shares one lookup between everyone on the same flight for 10
  minutes. Real use would need a paid plan or a provider with push updates (Phase B,
  with push notifications).
- Changing provider is a new `FlightStatusProvider` in the function; the app and the schema stay.
