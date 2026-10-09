# Booking import accuracy

Written by `scripts/parse-accuracy.mjs` (TR-28; scoring rules in ADR 0020). The golden set is
12 made-up bookings in `supabase/functions/parse-booking/golden/` (made by `make-golden.py`).
Live run: GitHub → Actions → Parse accuracy → Run workflow.

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
