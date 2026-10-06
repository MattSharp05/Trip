import type { Booking, BookingType } from '@/services/data/types';

import { useWallet } from '../useWallet';
import type { PlaceLookup } from '../walletItems';

export type BookingOf<T extends BookingType> = Extract<Booking, { type: T }>;

/**
 * One booking of the selected trip by id, if it has the given type, with the trip's places; null
 * once loaded if there's no such booking.
 */
export function useBooking<T extends BookingType>(
  id: string,
  type: T,
): { booking: BookingOf<T> | null; places: PlaceLookup; isLoading: boolean } {
  const { entries, places, isLoading } = useWallet();
  const entry = entries.find((e) => e.id === id);
  const booking = entry && entry.type === type && 'booking' in entry ? entry.booking : null;
  return { booking: booking as BookingOf<T> | null, places, isLoading };
}
