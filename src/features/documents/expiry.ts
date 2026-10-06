import { addMonths, format, parseISO } from 'date-fns';

import { isPast, type DatedTrip } from '@/core/trips';

/**
 * Passport expiry (TR-20). Many countries refuse entry when a passport has less than six months
 * left after the stay, so a document warns when it expires before any upcoming trip's end date
 * plus six months, or has already expired. `at` comes from `now()` in `@/core/clock`.
 */

export const VALIDITY_MONTHS = 6;

export type ExpiryWarning<T extends DatedTrip> =
  { kind: 'expired' } | { kind: 'too-soon'; trip: T };

/** The day a document has to outlast for a trip: its end date plus six months. */
export function validUntilNeeded(trip: DatedTrip): string {
  return format(addMonths(parseISO(trip.endDate), VALIDITY_MONTHS), 'yyyy-MM-dd');
}

/**
 * Why a document needs attention, or null. Expired wins; otherwise the soonest upcoming trip it
 * won't cover. A document with no expiry date never warns.
 */
export function expiryWarning<T extends DatedTrip>(
  expiresOn: string | null,
  trips: readonly T[],
  at: Date,
): ExpiryWarning<T> | null {
  if (!expiresOn) return null;
  if (expiresOn < format(at, 'yyyy-MM-dd')) return { kind: 'expired' };
  const trip = [...trips]
    .filter((t) => !isPast(t, at))
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
    .find((t) => expiresOn < validUntilNeeded(t));
  return trip ? { kind: 'too-soon', trip } : null;
}

/** The warning as one short line for a card or the detail screen. */
export function warningText(warning: ExpiryWarning<DatedTrip & { city: string }>): string {
  return warning.kind === 'expired'
    ? 'Expired: renew before you travel'
    : `Under 6 months left after ${warning.trip.city}`;
}
