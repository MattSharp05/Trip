import type {
  BucketItem,
  DataSnapshot,
  Expense,
  ItineraryItem,
  TravelDocument,
  Trip,
  TripData,
} from './types';

/**
 * Where screens' data comes from. Hooks (`./hooks`) read through the active source: Supabase for
 * a signed-in account, or the in-memory demo session a scenario loads (no network).
 */
export interface DataSource {
  /** Unique per source instance; part of every query key, so switching sources never mixes caches. */
  readonly id: string;
  readonly kind: 'demo' | 'supabase';
  listTrips(): Promise<Trip[]>;
  getTripData(tripId: string): Promise<TripData | null>;
  listDocuments(): Promise<TravelDocument[]>;
  saveItineraryItem(item: ItineraryItem): Promise<ItineraryItem>;
  deleteItineraryItem(id: string): Promise<void>;
  saveBucketItem(item: BucketItem): Promise<BucketItem>;
  deleteBucketItem(id: string): Promise<void>;
  saveExpense(expense: Expense): Promise<Expense>;
}

const byStart = (a: Trip, b: Trip) => a.startDate.localeCompare(b.startDate);
const byTime = (a: ItineraryItem, b: ItineraryItem) =>
  a.day.localeCompare(b.day) || (a.startTime ?? '99:99').localeCompare(b.startTime ?? '99:99');

function upsert<T extends { id: string }>(rows: T[], row: T): T[] {
  const i = rows.findIndex((r) => r.id === row.id);
  return i === -1 ? [...rows, row] : rows.map((r, j) => (j === i ? row : r));
}

let demoCount = 0;

/**
 * The demo session: a scenario's snapshot held in memory. Reads and writes never touch the
 * network, and each source gets its own deep copy, so reloading a scenario starts clean.
 */
export function createDemoSource(snapshot: DataSnapshot, name = 'demo'): DataSource {
  let db: DataSnapshot = JSON.parse(JSON.stringify(snapshot));
  const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value));
  demoCount += 1;

  return {
    id: `demo:${name}:${demoCount}`,
    kind: 'demo',
    async listTrips() {
      return copy([...db.trips].sort(byStart));
    },
    async getTripData(tripId) {
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
    async listDocuments() {
      return copy(db.documents);
    },
    async saveItineraryItem(item) {
      db = { ...db, items: upsert(db.items, copy(item)) };
      return copy(item);
    },
    async deleteItineraryItem(id) {
      db = { ...db, items: db.items.filter((i) => i.id !== id) };
    },
    async saveBucketItem(item) {
      db = { ...db, bucketItems: upsert(db.bucketItems, copy(item)) };
      return copy(item);
    },
    async deleteBucketItem(id) {
      db = { ...db, bucketItems: db.bucketItems.filter((b) => b.id !== id) };
    },
    async saveExpense(expense) {
      db = { ...db, expenses: upsert(db.expenses, copy(expense)) };
      return copy(expense);
    },
  };
}

/** Every place a booking points at (airports, hotel, rental counters, venue). */
export function bookingPlaceIds(booking: DataSnapshot['bookings'][number]): string[] {
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
