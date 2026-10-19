import { copy, type DemoStore, upsert } from '../shared/demo';
import type { BookingsSource } from './types';

/** The bookings slice of the demo source. */
export function demoBookings(store: DemoStore): BookingsSource {
  return {
    async saveBooking(booking) {
      const { db } = store;
      if (!db.bookings.some((b) => b.id === booking.id)) throw new Error('Booking not found');
      store.db = { ...db, bookings: upsert(db.bookings, copy(booking)) };
      return copy(booking);
    },
    async createBooking(booking) {
      const { db } = store;
      if (db.bookings.some((b) => b.id === booking.id)) throw new Error('Booking exists');
      store.db = { ...db, bookings: [...db.bookings, copy(booking)] };
      return copy(booking);
    },
    async deleteBooking(id) {
      store.db = { ...store.db, bookings: store.db.bookings.filter((b) => b.id !== id) };
    },
    async setBookingVisibility(id, visibility) {
      const { db } = store;
      const booking = db.bookings.find((b) => b.id === id);
      if (!booking) throw new Error('Booking not found');
      // As the database's trigger: only the traveller who added it changes who sees it.
      if ((booking.addedBy ?? db.me) !== db.me) throw new Error("Only the booking's owner");
      const next = { ...booking, visibility };
      store.db = { ...db, bookings: upsert(db.bookings, next) };
      return copy(next);
    },
  };
}
