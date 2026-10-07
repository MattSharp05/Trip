import type {
  Booking,
  BucketItem,
  DataSnapshot,
  DocumentInput,
  Expense,
  ItineraryItem,
  Money,
  NewTrip,
  Place,
  PlaceInput,
  SavedLink,
  SavedLinkInput,
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
  /** Adds a trip; the source assigns the id unless one is given (the sample trip, TR-35). */
  createTrip(trip: NewTrip, id?: string): Promise<Trip>;
  /** Deletes a trip with its bookings, itinerary, Bucket List, expenses and saved links. */
  deleteTrip(id: string): Promise<void>;
  getTripData(tripId: string): Promise<TripData | null>;
  listDocuments(): Promise<TravelDocument[]>;
  saveDocument(document: DocumentInput): Promise<TravelDocument>;
  deleteDocument(id: string): Promise<void>;
  saveItineraryItem(item: ItineraryItem): Promise<ItineraryItem>;
  deleteItineraryItem(id: string): Promise<void>;
  /** Adds a place (no id) or updates one; returns it with its id. */
  savePlace(place: PlaceInput): Promise<Place>;
  deletePlace(id: string): Promise<void>;
  /** Adds a saved TikTok or Instagram link (no id) or updates one; returns it with its id. */
  saveLink(link: SavedLinkInput): Promise<SavedLink>;
  /** Saves a bucket item, with `saved_link_id` from `item.link`. */
  saveBucketItem(item: BucketItem): Promise<BucketItem>;
  deleteBucketItem(id: string): Promise<void>;
  saveExpense(expense: Expense): Promise<Expense>;
  /** Set (or clear, with null) a trip's total budget. */
  saveTripBudget(tripId: string, budget: Money | null): Promise<Trip>;
  /** Updates an existing booking's JSON data and original file (e.g. a boarding pass crop). */
  saveBooking(booking: Booking): Promise<Booking>;
  /** Adds a new booking (an import); the caller picks its id. */
  createBooking(booking: Booking): Promise<Booking>;
  deleteBooking(id: string): Promise<void>;
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
  let linkCount = 0;

  return {
    id: `demo:${name}:${demoCount}`,
    kind: 'demo',
    async listTrips() {
      return copy([...db.trips].sort(byStart));
    },
    async createTrip(input, id) {
      const trip: Trip = {
        ...copy(input),
        id: id ?? `trip-${Date.now().toString(36)}-${db.trips.length}`,
      };
      db = { ...db, trips: [...db.trips, trip] };
      return copy(trip);
    },
    async deleteTrip(id) {
      const other = <T extends { tripId: string }>(rows: T[]) =>
        rows.filter((r) => r.tripId !== id);
      db = {
        ...db,
        trips: db.trips.filter((t) => t.id !== id),
        items: other(db.items),
        bookings: other(db.bookings),
        bucketItems: other(db.bucketItems),
        expenses: other(db.expenses),
      };
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
    async saveDocument(input) {
      const document: TravelDocument = {
        ...copy(input),
        id: input.id ?? `document-${Date.now().toString(36)}-${db.documents.length}`,
      };
      db = { ...db, documents: upsert(db.documents, document) };
      return copy(document);
    },
    async deleteDocument(id) {
      db = { ...db, documents: db.documents.filter((d) => d.id !== id) };
    },
    async saveItineraryItem(item) {
      db = { ...db, items: upsert(db.items, copy(item)) };
      return copy(item);
    },
    async deleteItineraryItem(id) {
      db = { ...db, items: db.items.filter((i) => i.id !== id) };
    },
    async savePlace(input) {
      const place: Place = {
        ...copy(input),
        id: input.id ?? `place-${Date.now().toString(36)}-${db.places.length}`,
      };
      db = { ...db, places: upsert(db.places, place) };
      return copy(place);
    },
    async deletePlace(id) {
      // As in Postgres: rows that pointed at it keep going without a place.
      db = {
        ...db,
        places: db.places.filter((p) => p.id !== id),
        items: db.items.map((i) => (i.placeId === id ? { ...i, placeId: null } : i)),
      };
    },
    async saveLink(input) {
      // Demo links live on the bucket items that point at them; nothing else lists them.
      return copy({ ...input, id: input.id ?? `link-${Date.now().toString(36)}-${++linkCount}` });
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
    async saveTripBudget(tripId, budget) {
      const trip = db.trips.find((t) => t.id === tripId);
      if (!trip) throw new Error(`No trip ${tripId}`);
      const next: Trip = { ...trip, budget: budget ? copy(budget) : null };
      db = { ...db, trips: upsert(db.trips, next) };
      return copy(next);
    },
    async saveBooking(booking) {
      if (!db.bookings.some((b) => b.id === booking.id)) throw new Error('Booking not found');
      db = { ...db, bookings: upsert(db.bookings, copy(booking)) };
      return copy(booking);
    },
    async createBooking(booking) {
      if (db.bookings.some((b) => b.id === booking.id)) throw new Error('Booking exists');
      db = { ...db, bookings: [...db.bookings, copy(booking)] };
      return copy(booking);
    },
    async deleteBooking(id) {
      db = { ...db, bookings: db.bookings.filter((b) => b.id !== id) };
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
