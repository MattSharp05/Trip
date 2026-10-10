# 0028 — Live updates with Supabase Realtime

**Context.** In a group trip, a stop Blake adds should appear on Matthew's map without pulling to
refresh (PRD v2: "map and itinerary update for everyone"). The app reads through TanStack Query
(`dataKeys`, ADR 0008) and has no realtime code. Expo Go must keep working (ADR 0001).

**Decision.**
- Use **Supabase Realtime `postgres_changes`**, already part of `@supabase/supabase-js` (plain
  WebSocket, no native code, works in Expo Go). The free plan allows 200 concurrent connections and
  2 million messages a month, far beyond the demo.
- A migration adds the trip-scoped tables (`trips`, `trip_members`, `itinerary_items`,
  `bucket_items`, bucket likes, opt-outs, `bookings`, `expenses` and their v2 children) to the
  `supabase_realtime` publication. Realtime applies the same RLS, so a non-member never receives a
  row.
- One channel per open trip (`trip:<id>`), opened by `useTripLiveUpdates(tripId)` in the tabs
  layout, filtered by `trip_id=eq.<id>`. Any change invalidates that trip's queries
  (`dataKeys.trip`, members, expenses), debounced by 300 ms; we refetch rather than patch the cache,
  so there is one code path for reads. Our own writes already invalidate, so echoes are harmless.
- The channel closes when the app goes to the background and reopens (with one refetch) when it
  comes back. Demo sessions (scenarios) never open a channel.

**Consequences.**
- Simple and correct; costs one refetch per burst of changes.
- Deletes arrive without the old row's `trip_id` unless the table has `replica identity full`; the
  migration sets it on the published tables.
- **Amended in TR-54:** Realtime doesn't apply RLS to delete events, so with deletes published
  anyone who knew a trip's id heard its rows' deletes (primary keys only), member or not. The
  publication carries inserts and updates only (`0054_realtime_no_deletes.sql`); a statement-level
  `after delete` trigger on each trip-scoped table touches the trip's `updated_at`, and members
  hear that `trips` update (RLS applies). A deleted trip itself isn't announced; members see it gone
  on their next trips refetch. New trip-scoped tables add the same trigger.
- Live updates are tested with two real accounts (Matthew's phone + a second account) and in
  `db:test-rls` (a member receives a change, a non-member doesn't).
