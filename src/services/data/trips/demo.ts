import { bookingPlaceIds } from '../bookings/placeIds';
import type { ItineraryItem } from '../itinerary/types';
import { copy, type DemoStore, upsert } from '../shared/demo';
import type { Trip, TripsSource } from './types';

const byStart = (a: Trip, b: Trip) => a.startDate.localeCompare(b.startDate);
const byTime = (a: ItineraryItem, b: ItineraryItem) =>
  a.day.localeCompare(b.day) || (a.startTime ?? '99:99').localeCompare(b.startTime ?? '99:99');

/** The trips slice of the demo source. */
export function demoTrips(store: DemoStore): TripsSource {
  return {
    async listTrips() {
      return copy([...store.db.trips].sort(byStart));
    },
    async createTrip(input, id) {
      const { db } = store;
      const trip: Trip = {
        ...copy(input),
        id: id ?? `trip-${Date.now().toString(36)}-${db.trips.length}`,
      };
      store.db = { ...db, trips: [...db.trips, trip] };
      return copy(trip);
    },
    async deleteTrip(id) {
      const { db } = store;
      const other = <T extends { tripId: string }>(rows: T[]) =>
        rows.filter((r) => r.tripId !== id);
      store.db = {
        ...db,
        trips: db.trips.filter((t) => t.id !== id),
        items: other(db.items),
        bookings: other(db.bookings),
        bucketItems: other(db.bucketItems),
        expenses: other(db.expenses),
      };
    },
    async getTripData(tripId) {
      const { db } = store;
      const trip = db.trips.find((t) => t.id === tripId);
      if (!trip) return null;
      const items = db.items.filter((i) => i.tripId === tripId).sort(byTime);
      const bookings = db.bookings.filter((b) => b.tripId === tripId);
      const bucketItems = db.bucketItems.filter((b) => b.tripId === tripId);
      const expenses = db.expenses.filter((e) => e.tripId === tripId);
      const placeIds = new Set<string>([
        ...items.flatMap((i) => (i.placeId ? [i.placeId] : [])),
        ...bucketItems.map((b) => b.placeId),
        ...bookings.flatMap(bookingPlaceIds),
      ]);
      const places = db.places.filter((p) => placeIds.has(p.id));
      return copy({ trip, places, items, bookings, bucketItems, expenses });
    },
    async saveTripBudget(tripId, budget) {
      const { db } = store;
      const trip = db.trips.find((t) => t.id === tripId);
      if (!trip) throw new Error(`No trip ${tripId}`);
      const next: Trip = { ...trip, budget: budget ? copy(budget) : null };
      store.db = { ...db, trips: upsert(db.trips, next) };
      return copy(next);
    },
  };
}
