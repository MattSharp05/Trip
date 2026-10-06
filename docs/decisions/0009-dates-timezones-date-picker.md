# 0009 — Date libraries, offline timezone lookup and the date picker

**Context.** TR-10 adds the Trips list (Upcoming / Past by each trip's end date against "today" in
the trip's timezone) and "create a trip", which needs a date picker and the destination's IANA
timezone from its coordinates. Everything must run in Expo Go (ADR 0001).

**Decision.**
- `date-fns` + `date-fns-tz` (pure JS), as the TDD's Conventions already name, for date maths and
  "today in a timezone" (`src/core/trips.ts`).
- `tz-lookup` (pure JS, about 70 KB, no network) for coordinates → IANA timezone
  (`src/core/timezone.ts`). Its boundaries are simplified near borders, which is fine for city
  centres; it falls back to UTC for coordinates it rejects.
- `@react-native-community/datetimepicker` for the start and end dates: it is in Expo Go's bundled
  modules and shows the native iOS compact date picker.

**Consequences.**
- No native code outside Expo Go; the Expo Go dependency test stays green.
- A timezone lookup costs nothing and works offline; a server-side lookup can replace it later if
  border accuracy ever matters.
