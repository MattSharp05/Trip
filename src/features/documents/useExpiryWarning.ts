import { now } from '@/core/clock';
import { useTrips } from '@/services/data';
import type { Trip } from '@/services/data/types';

import { expiryWarning, type ExpiryWarning } from './expiry';

/** The document's expiry warning against the account's trips (all of them, not just the selected one). */
export function useExpiryWarning(expiresOn: string | null): ExpiryWarning<Trip> | null {
  const trips = useTrips();
  return expiryWarning(expiresOn, trips.data ?? [], now());
}
