# 0026 — Booking import: tidy the model's answer, and how addresses are scored

**Context.** The first live accuracy run (TR-28, ADR 0020) scored 81.8%: event tickets 0%. TR-49
looked at each miss. The sports ticket was read but rejected, because answers that are nearly
right (`"row": 12` as a number, `"type": "event"`, no `{ "booking": … }` wrapper) fail the Zod
schema and the whole import becomes "We couldn't find a booking". Flight legs came back with no
country when the pass printed only the airport code. One hotel address came back as the street
only, and the golden set itself disagreed on addresses: five expect the street alone and one
expects the whole printed line. The restaurant screenshot's year and time were wrong because
`make-golden.py` drew "Tue 5 May 2026" over "21:00" in its 3-column grid.

**Decision.**
- `parse-booking` runs the model's JSON through `normalizeAnswer` (`_shared/parse/normalize.ts`)
  before validation. It only reshapes what the model sent: numbers in text fields become text,
  type words map onto the five types, a lone booking or a one-item `bookings` list is wrapped,
  ISO country codes become names ("PT" → "Portugal"), `€`/`£`/`¥` become codes, and an empty
  airport city or country is filled from a static IATA table of about 100 busy airports
  (`airports.ts`). An unknown airport keeps what the model read; nothing is guessed. Answers
  that still fail validation return their schema issues (paths and rules, no booking content) in
  the 422 body, so the accuracy report says why.
- The prompt says event, sports and concert tickets, e-tickets and wallet passes are `ticket`
  bookings, carries today's date, and tells the model to copy printed years and to pick a
  missing year by the printed weekday. Addresses are asked for whole, as printed.
- Scoring (amends ADR 0020): an address is right when the expected street matches and the rest of
  the address, if either side has more, follows it ("410 Example Street" = "410 Example Street,
  San Diego, CA 92101"). City and country already have their own fields, so the address field
  stops scoring them twice. A different street is still a miss.
- `make-golden.py` refuses to draw a grid value wider than its column; the restaurant screenshot
  now has a 2-column grid. The expected answers and `recorded/` are unchanged.
- The geocoder adds the city to a street-only address.

**Consequences.**
- Fewer whole-import failures from formatting slips; the schema stays strict for the app.
- The IATA table only covers common airports; others rely on the model.
- Accuracy figures from before and after this ADR differ slightly in how addresses count (one
  field in the golden set: `hotel-email`).
