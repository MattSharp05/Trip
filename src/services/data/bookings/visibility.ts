import type { Booking, BookingVisibility } from './types';

/**
 * Who can see a booking (Mine / Shared, ADR 0027). A booking without one (v1 fixtures) has the
 * default for its type, as the database gives new rows: flights private, everything else shared.
 */
export function bookingVisibility(booking: Booking): BookingVisibility {
  return booking.visibility ?? (booking.type === 'flight' ? 'private' : 'shared');
}
