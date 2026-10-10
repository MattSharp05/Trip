import type { DataSnapshot } from '../types';

/**
 * The demo session's tables, held in memory. Each domain's demo slice reads `db` and replaces it
 * on every write, so all slices of one source share one copy of the scenario.
 */
export interface DemoStore {
  db: DataSnapshot;
}

/** A deep copy: callers never hold a reference into the store, and the store never into theirs. */
export const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value));

/** Replaces the row with the same id, or appends it. */
export function upsert<T extends { id: string }>(rows: T[], row: T): T[] {
  const i = rows.findIndex((r) => r.id === row.id);
  return i === -1 ? [...rows, row] : rows.map((r, j) => (j === i ? row : r));
}
