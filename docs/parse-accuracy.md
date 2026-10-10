# Booking import accuracy

Written by `scripts/parse-accuracy.mjs` (TR-28; scoring rules in ADR 0020). The golden set is
12 made-up bookings in `supabase/functions/parse-booking/golden/` (made by `make-golden.py`).
Live run: GitHub → Actions → Parse accuracy → Run workflow.

**Live baseline: 82.7%** (158 of 191 fields), live (deployed parse-booking function), 2026-10-10. Target ≥ 90%.

| Type | Bookings | Right | Fields | Accuracy |
| --- | ---: | ---: | ---: | ---: |
| Flights | 3 | 57 | 76 | 75% |
| Hotels | 3 | 40 | 40 | 100% |
| Car rentals | 2 | 17 | 31 | 54.8% |
| Event tickets | 2 | 27 | 27 | 100% |
| Restaurant reservations | 2 | 17 | 17 | 100% |
| **Overall** | 12 | 158 | 191 | **82.7%** |

## Per booking

| Booking | Accuracy | Misses (field: expected → got) |
| --- | ---: | --- |
| car-airport | 0% | parse failed: 504  Request idle timeout limit (150s) reached |
| car-oneway | 100% | — |
| flight-mobile | 0% | parse failed: 504  Request idle timeout limit (150s) reached |
| flight-oneway | 100% | — |
| flight-roundtrip | 100% | — |
| hotel-email | 100% | — |
| hotel-guesthouse | 100% | — |
| hotel-homestay | 100% | — |
| restaurant-app | 100% | — |
| restaurant-email | 100% | — |
| ticket-concert | 100% | — |
| ticket-match | 100% | — |

Mode: live (deployed parse-booking function). Run: 2026-10-10.
