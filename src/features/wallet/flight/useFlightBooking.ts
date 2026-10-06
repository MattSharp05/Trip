import type { Booking } from '@/services/data/types';

import { useWallet } from '../useWallet';

export type FlightBooking = Extract<Booking, { type: 'flight' }>;

/** One flight booking of the selected trip, by id; null once loaded if there's no such flight. */
export function useFlightBooking(id: string): { flight: FlightBooking | null; isLoading: boolean } {
  const { entries, isLoading } = useWallet();
  const entry = entries.find((e) => e.id === id);
  return { flight: entry?.type === 'flight' ? entry.booking : null, isLoading };
}
