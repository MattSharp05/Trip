# 0009 — Date library and weather source

**Context.** TR-12 is the first ticket that formats and counts calendar days (date pills, day
header, "today" in the trip's timezone) and shows weather. The TDD already names `date-fns` +
`date-fns-tz` for dates and Open-Meteo for weather; this records adding them.

**Decision.**
- `date-fns` (v4) and `date-fns-tz` (v3), both pure JavaScript, so they run in Expo Go (ADR 0001).
  Trip days stay `YYYY-MM-DD` wall-clock strings; only "today" is computed in a timezone
  (`formatInTimeZone`). Helpers live in `src/core/dates.ts`.
- Weather from Open-Meteo's daily forecast, called directly from the app (no key, nothing to
  hide in an Edge Function), through `src/services/weather.ts` and TanStack Query, cached an hour
  per location and day range. Only days from today to 16 days ahead are requested; other days
  show no weather rather than made-up values. Temperatures are kept in °C and converted for
  display.
- Demo sessions (scenarios) get deterministic fixture weather and never call the API.

**Consequences.**
- No native code; the Expo Go dependency test stays green. date-fns is tree-shaken per function.
- Open-Meteo's free tier is for non-commercial use: fine for the demo, revisit in Phase B (TDD
  risk 6).
