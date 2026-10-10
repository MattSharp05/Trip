import { check, checkRow, client, type Row } from '../shared/supabase';
import type { Booking, BookingsSource } from './types';

export const toBooking = (r: Row<'bookings'>): Booking =>
  ({
    id: r.id,
    tripId: r.trip_id,
    originalPath: r.original_path,
    type: r.type,
    data: r.data,
  }) as unknown as Booking;

/** The bookings slice of the Supabase source. */
export const supabaseBookings: BookingsSource = {
  async saveBooking(booking) {
    const supabase = client();
    const row = checkRow(
      await supabase
        .from('bookings')
        .update({
          data: JSON.parse(JSON.stringify(booking.data)),
          original_path: booking.originalPath,
        })
        .eq('id', booking.id)
        .select()
        .single(),
    );
    return toBooking(row);
  },
  async createBooking(booking) {
    const supabase = client();
    const row = checkRow(
      await supabase
        .from('bookings')
        .insert({
          id: booking.id,
          trip_id: booking.tripId,
          type: booking.type,
          data: JSON.parse(JSON.stringify(booking.data)),
          original_path: booking.originalPath,
        })
        .select()
        .single(),
    );
    return toBooking(row);
  },
  async deleteBooking(id) {
    const supabase = client();
    check(await supabase.from('bookings').delete().eq('id', id));
  },
};
