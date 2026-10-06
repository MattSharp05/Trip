import { dayIn } from './dates';

/**
 * Trips list logic (TR-10). A trip is past once its end date is before "today" in the trip's own
 * timezone, so a Tokyo trip ends on Tokyo's calendar, not the phone's. `at` comes from
 * `now()` in `@/core/clock`, which scenarios pin.
 */

export type TripFilter = 'upcoming' | 'past' | 'all';

/** The fields these helpers need; `Trip` from the data layer fits. */
export interface DatedTrip {
  startDate: string;
  endDate: string;
  timezone: string;
}

/** Today's date (`YYYY-MM-DD`) in an IANA timezone at an instant; UTC if the zone is unknown. */
export function todayIn(timezone: string, at: Date): string {
  try {
    return dayIn(timezone, at);
  } catch {
    return dayIn('UTC', at);
  }
}

export function isPast(trip: DatedTrip, at: Date): boolean {
  return trip.endDate < todayIn(trip.timezone, at);
}

const byStart = (a: DatedTrip, b: DatedTrip) => a.startDate.localeCompare(b.startDate);
const byEndDescending = (a: DatedTrip, b: DatedTrip) => b.endDate.localeCompare(a.endDate);

/**
 * Upcoming: not over yet (includes a trip in progress), soonest first. Past: ended before today,
 * most recent first. All: every trip by start date.
 */
export function filterTrips<T extends DatedTrip>(
  trips: readonly T[],
  filter: TripFilter,
  at: Date,
): T[] {
  switch (filter) {
    case 'upcoming':
      return trips.filter((t) => !isPast(t, at)).sort(byStart);
    case 'past':
      return trips.filter((t) => isPast(t, at)).sort(byEndDescending);
    case 'all':
      return [...trips].sort(byStart);
  }
}

/** The trip to show when none is selected: the next or current one, else the latest past one. */
export function defaultTrip<T extends DatedTrip>(trips: readonly T[], at: Date): T | null {
  return filterTrips(trips, 'upcoming', at)[0] ?? filterTrips(trips, 'past', at)[0] ?? null;
}
