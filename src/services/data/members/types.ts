/**
 * Trip members (v2: Group trips, TDD → v2 → App; ADR 0027). An empty skeleton: the members
 * ticket fills this folder in, like every other domain here:
 * - `types.ts`: the models (e.g. `TripMember`) and `MembersSource`, this domain's slice of
 *   `DataSource` (it is already composed into `DataSource` in `../source.ts`);
 * - `demo.ts`: `demoMembers`, its slice of the in-memory demo source;
 * - `supabase.ts`: `supabaseMembers`, its slice of the Supabase source plus row mappers;
 * - `hooks.ts`: its React Query hooks (e.g. `useTripMembers`); add its `export *` line to
 *   `../hooks.ts` with the first hook;
 * - tests next to each file (`demo.test.ts`, `supabase.test.ts`).
 */

/** The members slice of `DataSource`; no methods yet. */
export type MembersSource = Record<never, never>;
