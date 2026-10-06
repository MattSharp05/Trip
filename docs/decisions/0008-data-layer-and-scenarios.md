# 0008 — Data layer, UI state and the scenario demo session

**Context.** TR-6 adds scenarios (TDD → Scenario system): named, deterministic states opened by a
deep link, with no Supabase writes. Screens must therefore read data through one layer that can be
backed by Supabase (a signed-in account) or by an in-memory copy of a scenario's fixtures. The TDD
already names TanStack Query (server state) and Zustand (UI state); this ADR records adding them.

**Decision.**
- `@tanstack/react-query` (pure JS) for data hooks (`src/services/data/hooks.ts`). The hooks pass a
  module-level `QueryClient` explicitly, so they work without a provider in the root layout.
- `zustand` (pure JS) for small UI stores in `src/stores/` (selected trip, active scenario) and the
  active data source.
- A `DataSource` interface (`src/services/data/source.ts`) with two implementations: Supabase
  (`supabaseSource`, required lazily so demo sessions never create a client) and the demo source
  (`createDemoSource`, a deep copy of a scenario snapshot, read/write in memory). Query keys include
  the source id, so switching sources never mixes caches.
- A pinned clock (`src/core/clock.ts`): everything date-dependent calls `now()`; a scenario pins it
  (default Fri Nov 13 2026, 9:00 AM Las Vegas).
- Scenarios are enabled in dev builds and when `EXPO_PUBLIC_SCENARIOS=1`, which CI sets for the
  `main` EAS Update during the demo phase. Elsewhere `/scenario/<name>` and `/dev` redirect to Trips.

**Consequences.**
- No native code; the Expo Go dependency test stays green.
- A few demo-only fields have no column yet (`ItineraryItem.title`, `Expense.description`,
  `Trip.budget`); Supabase rows map them to undefined until a migration adds them.
- Phase B: turn scenarios off for the production channel by leaving `EXPO_PUBLIC_SCENARIOS` unset.
