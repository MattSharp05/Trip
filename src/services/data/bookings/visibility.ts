import type { Booking, BookingType, BookingVisibility } from './types';

/**
 * Who sees a new booking of this type (ADR 0027, PRD decision 3): flights private, everything else
 * (hotels, cars, tickets, reservations) shared, as the database defaults new rows.
 */
export function defaultVisibility(type: BookingType | 'reservation'): BookingVisibility {
  return type === 'flight' ? 'private' : 'shared';
}

/**
 * Who can see a booking (Mine / Shared, ADR 0027). A booking without one (v1 fixtures) has the
 * default for its type.
 */
export function bookingVisibility(booking: Booking): BookingVisibility {
  return booking.visibility ?? defaultVisibility(booking.type);
}
