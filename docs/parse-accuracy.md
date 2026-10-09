# Booking import accuracy

Written by `scripts/parse-accuracy.mjs` (TR-28; scoring rules in ADR 0020). The golden set is
12 made-up bookings in `supabase/functions/parse-booking/golden/` (made by `make-golden.py`).
Live run: GitHub → Actions → Parse accuracy → Run workflow.

## TR-49 re-run (2026-10-09): partial, Gemini daily quota spent

The TR-49 changes (ADR 0026) were deployed from branch `tr-49/ticket-parsing` and the live run was
started with `--min 90`. After 2 bookings the free tier answered 429 on every try for over 4
minutes (the per-minute cap clears in one), so the day's quota was spent (the TR-28 runs earlier
today used most of it). The run was stopped rather than score 10 bookings as 0%.

| Booking | Live result |
| --- | --- |
| car-airport | 100% (14 of 14) |
| car-oneway | 100% (17 of 17) |
| flight-mobile | not measured: rate limited (daily quota) |
| the other 9 | not run |

**No new overall figure yet.** The ≥ 90% target is unproven until a full run: GitHub → Actions →
Parse accuracy → Run workflow, once this is merged (main redeploys the functions) and the quota
has reset (midnight Pacific). That run overwrites this file.

What the baseline misses below become by construction, without a new model call (not a
measurement):
- Flights: the 4 empty airport countries are filled from the IATA table → 76 of 76 if the model
  answers as it did.
- Hotels: `hotel-email`'s street-only address now matches (address scoring, ADR 0026) → 40 of 41;
  `hotel-homestay`'s `room` extra depends on the new prompt line.
- Restaurants: `restaurant-app`'s screenshot drew the date over the time; it is redrawn, so the
  year and time misses were the golden file's fault. Not yet re-measured.
- Event tickets: the sports ticket's rejection is the schema-strictness case the answer cleanup
  fixes (numbers in text fields, type words, ISO countries, wrapper), and the prompt now names
  e-tickets, sports and wallet passes. Not yet re-measured; the 422 now reports the schema issues
  if it still fails.

## TR-28 baseline

**Live baseline: 81.8%** (157 of 192 fields), live (deployed parse-booking function), 2026-10-09. Target ≥ 90%.

| Type | Bookings | Right | Fields | Accuracy |
| --- | ---: | ---: | ---: | ---: |
| Flights | 3 | 72 | 76 | 94.7% |
| Hotels | 3 | 39 | 41 | 95.1% |
| Car rentals | 2 | 31 | 31 | 100% |
| Event tickets | 2 | 0 | 27 | 0% |
| Restaurant reservations | 2 | 15 | 17 | 88.2% |
| **Overall** | 12 | 157 | 192 | **81.8%** |

## Per booking

| Booking | Accuracy | Misses (field: expected → got) |
| --- | ---: | --- |
| car-airport | 100% | — |
| car-oneway | 100% | — |
| flight-mobile | 89.5% | legs.0.from.country: `United States` → —<br>legs.0.to.country: `United States` → — |
| flight-oneway | 100% | — |
| flight-roundtrip | 94.6% | legs.0.from.country: `United States` → —<br>legs.1.from.country: `Portugal` → — |
| hotel-email | 93.8% | hotel.address: `410 Example Street, San Diego, CA 92101` → `410 Example Street` |
| hotel-guesthouse | 100% | — |
| hotel-homestay | 91.7% | room: — → `Entire loft` |
| restaurant-app | 75% | starts.date: `2026-05-05` → `2025-05-05`<br>starts.time: `21:00` → `19:00` |
| restaurant-email | 100% | — |
| ticket-concert | 0% | parse failed: still rate limited after 4 tries |
| ticket-match | 0% | parse failed: 422 unreadable We couldn't find a booking in that file. Try a clearer PDF or screenshot. |

Mode: live (deployed parse-booking function). Run: 2026-10-09.
