# 0020 — Booking-import accuracy: golden set and scoring rules

**Context.** The PRD's import criterion is "≥ 90% of fields right" per sample booking type, and
ADR 0004 says it is measured on a fixed sample set in CI. TR-28 builds that set and the scorer.
"Fields right" needs a definition that a model can't game by leaving things out or by padding
answers, and the live check spends free-tier quota, so it can't run on every PR.

**Decision.**
- **Golden set:** 12 made-up bookings in `supabase/functions/parse-booking/golden/` (3 flights, one
  of them with 2 legs; 3 hotels, one a home-rental app screenshot; 2 cars, one one-way; 2 event
  tickets; 2 restaurant reservations), as PDFs and phone-sized PNGs. One committed Python script
  (`make-golden.py`, Pillow + ReportLab, deterministic) draws each file and writes its
  `<name>.expected.json`, so the picture and the expected answer can't drift apart. Everything is
  fabricated (`.example` domains, 555 numbers); airport codes and cities are real.
- **Scoring** (`scripts/parse-accuracy.mjs`): every non-null field of the expected booking counts
  once; coordinates are skipped (the geocoder fills them, not the model). A field is right when
  the normalised values match: text ignores case, accents, punctuation and spacing; times are
  `HH:MM` (also from `8:25 PM`); dates the first `YYYY-MM-DD`; phones digits only; websites without
  scheme, `www.` or trailing slash; numbers to the cent. A non-null field the booking doesn't have
  counts as a miss too, so accuracy = right ÷ (expected fields + extras). A failed parse scores 0.
  Per-type and overall figures weigh every field the same.
- **Where it runs:** the live run calls the deployed `parse-booking` function over HTTP as a
  throwaway user (the real prompt, validation and model), from a manual-dispatch workflow
  (`parse-accuracy.yml`). PR CI runs the same script on canned answers (`golden/recorded/`) in
  Jest, which proves the scorer and the golden set, not the model. `--record` on a live run
  replaces the canned answers with real ones.

**Consequences.**
- The fixture-mode figure is a scorer check, never a quality claim; only a live run is a baseline.
- Strict extras mean a model that guesses (fills fields the booking doesn't have) loses points,
  matching the prompt's "never guess".
- Adding a booking type or field means a new golden booking in `make-golden.py`; the scorer needs
  no change unless the field needs its own normalisation.
