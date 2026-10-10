import type { Booking } from './types';

/** Every place a booking points at (airports, hotel, rental counters, venue). */
export function bookingPlaceIds(booking: Booking): string[] {
  switch (booking.type) {
    case 'flight':
      return [booking.data.from.placeId, booking.data.to.placeId].filter(
        (id): id is string => id !== null,
      );
    case 'hotel':
      return [booking.data.placeId];
    case 'car':
      return [booking.data.pickupPlaceId, booking.data.returnPlaceId];
    case 'ticket':
      return [booking.data.placeId];
  }
}
