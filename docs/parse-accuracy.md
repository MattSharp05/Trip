# Booking import accuracy

Written by `scripts/parse-accuracy.mjs` (TR-28; scoring rules in ADR 0020). The golden set is
12 made-up bookings in `supabase/functions/parse-booking/golden/` (made by `make-golden.py`).
Live run: GitHub → Actions → Parse accuracy → Run workflow.

**Fixture mode: 96.4% (scorer check); live baseline pending GEMINI_API_KEY.** The canned answers are not model output, so this number only proves the scorer works. Target ≥ 90% on a live run.

| Type | Bookings | Right | Fields | Accuracy |
| --- | ---: | ---: | ---: | ---: |
| Flights | 3 | 74 | 76 | 97.4% |
| Hotels | 3 | 39 | 41 | 95.1% |
| Car rentals | 2 | 30 | 31 | 96.8% |
| Event tickets | 2 | 26 | 27 | 96.3% |
| Restaurant reservations | 2 | 17 | 18 | 94.4% |
| **Overall** | 12 | 186 | 193 | **96.4%** |

## Per booking

| Booking | Accuracy | Misses (field: expected → got) |
| --- | ---: | --- |
| car-airport | 100% | — |
| car-oneway | 94.1% | returnLocation.city: `Los Angeles` → — |
| flight-mobile | 94.7% | legs.0.arrives.time: `08:15` → `08:51` |
| flight-oneway | 100% | — |
| flight-roundtrip | 97.3% | legs.1.seat: `23C` → — |
| hotel-email | 100% | — |
| hotel-guesthouse | 100% | — |
| hotel-homestay | 83.3% | hotel.city: `Austin` → `Austin, TX`<br>hotel.address: — → `Zilker Park` |
| restaurant-app | 88.9% | confirmation: — → `TASCA` |
| restaurant-email | 100% | — |
| ticket-concert | 100% | — |
| ticket-match | 92.3% | venue.country: `Portugal` → `PT` |

Mode: fixture (canned answers in golden/recorded/, not model output). Run: 2026-10-07.
