import type { Database } from '../database.types';
import { bookingPlaceIds, type DataSource } from './source';
import type {
  Booking,
  BucketItem,
  Expense,
  ItemKind,
  ItineraryItem,
  PhotoCredit,
  Place,
  TravelDocument,
  Trip,
} from './types';

type Tables = Database['public']['Tables'];
type Row<T extends keyof Tables> = Tables[T]['Row'];

/** Required on first use, so demo sessions and tests never create a Supabase client. */
const client = (): (typeof import('../supabase'))['supabase'] =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('../supabase').supabase;

/** Postgres `time` comes back as `HH:MM:SS`; the app uses `HH:MM`. */
const hhmm = (t: string | null) => (t ? t.slice(0, 5) : null);

type Result = { data: unknown; error: { message: string } | null };

/** The query's data, or throw its error. */
function check<R extends Result>({ data, error }: R): R['data'] {
  if (error) throw new Error(error.message);
  return data;
}

/** Like `check`, for lists and `.single()`, whose data is never null on success. */
function checkRow<R extends Result>(result: R): NonNullable<R['data']> {
  return check(result) as NonNullable<R['data']>;
}

const toTrip = (r: Row<'trips'>): Trip => ({
  id: r.id,
  city: r.city,
  country: r.country,
  lat: r.lat,
  lng: r.lng,
  timezone: r.timezone,
  startDate: r.start_date,
  endDate: r.end_date,
  coverPhotoUrl: r.cover_photo_url,
  coverPhotoCredit: (r.cover_photo_credit as PhotoCredit | null) ?? null,
  budget:
    r.budget_minor != null && r.budget_currency
      ? { amountMinor: r.budget_minor, currency: r.budget_currency }
      : null,
});

const toPlace = (r: Row<'places'>): Place => ({
  id: r.id,
  name: r.name,
  address: r.address,
  lat: r.lat,
  lng: r.lng,
  kind: r.kind,
  photoUrl: r.photo_url,
  sourceUrl: r.source_url,
});

const toItem = (r: Row<'itinerary_items'>): ItineraryItem => ({
  id: r.id,
  tripId: r.trip_id,
  day: r.day,
  startTime: hhmm(r.start_time),
  durationMinutes: r.duration_minutes,
  placeId: r.place_id,
  kind: r.kind as ItemKind,
  bookingId: r.booking_id,
  fixed: r.fixed,
  ...(r.title ? { title: r.title } : {}),
  notes: r.notes,
});

const toBooking = (r: Row<'bookings'>): Booking =>
  ({
    id: r.id,
    tripId: r.trip_id,
    originalPath: r.original_path,
    type: r.type,
    data: r.data,
  }) as unknown as Booking;

const toBucket = (r: Row<'bucket_items'>): BucketItem => ({
  id: r.id,
  tripId: r.trip_id,
  placeId: r.place_id ?? '',
  durationMinutes: r.duration_minutes,
  windowStart: hhmm(r.window_start),
  windowEnd: hhmm(r.window_end),
  source: r.source,
  fixedDate: r.fixed_date,
  fixedTime: hhmm(r.fixed_time),
  ...(r.title ? { title: r.title } : {}),
});

const toExpense = (r: Row<'expenses'>): Expense => ({
  id: r.id,
  tripId: r.trip_id,
  amountMinor: r.amount_minor,
  currency: r.currency,
  category: r.category ?? 'Other',
  bookingId: r.booking_id,
  paidAt: r.paid_at,
  ...(r.description ? { description: r.description } : {}),
});

const toDocument = (r: Row<'documents'>): TravelDocument => ({
  id: r.id,
  type: r.type === 'visa' ? 'visa' : 'passport',
  country: r.country,
  number: r.number,
  expiresOn: r.expires_on,
  imagePaths: r.image_paths,
});

/** The signed-in account's data. RLS scopes every query to the user; `user_id` defaults to them. */
export const supabaseSource: DataSource = {
  id: 'supabase',
  kind: 'supabase',
  async listTrips() {
    const supabase = client();
    const rows = checkRow(await supabase.from('trips').select('*').order('start_date'));
    return rows.map(toTrip);
  },
  async createTrip(trip) {
    const supabase = client();
    const row = checkRow(
      await supabase
        .from('trips')
        .insert({
          city: trip.city,
          country: trip.country,
          lat: trip.lat,
          lng: trip.lng,
          timezone: trip.timezone,
          start_date: trip.startDate,
          end_date: trip.endDate,
          cover_photo_url: trip.coverPhotoUrl,
          cover_photo_credit: trip.coverPhotoCredit ? { ...trip.coverPhotoCredit } : null,
        })
        .select()
        .single(),
    );
    return toTrip(row);
  },
  async getTripData(tripId) {
    const supabase = client();
    const tripRow = check(await supabase.from('trips').select('*').eq('id', tripId).maybeSingle());
    if (!tripRow) return null;
    const [items, bookings, bucketItems, expenses] = await Promise.all([
      supabase
        .from('itinerary_items')
        .select('*')
        .eq('trip_id', tripId)
        .order('day')
        .order('start_time'),
      supabase.from('bookings').select('*').eq('trip_id', tripId),
      supabase.from('bucket_items').select('*').eq('trip_id', tripId),
      supabase.from('expenses').select('*').eq('trip_id', tripId),
    ]).then(
      ([i, b, k, e]) =>
        [
          checkRow(i).map(toItem),
          checkRow(b).map(toBooking),
          checkRow(k).map(toBucket),
          checkRow(e).map(toExpense),
        ] as const,
    );
    const placeIds = [
      ...new Set([
        ...items.flatMap((i) => (i.placeId ? [i.placeId] : [])),
        ...bucketItems.flatMap((b) => (b.placeId ? [b.placeId] : [])),
        ...bookings.flatMap(bookingPlaceIds),
      ]),
    ];
    const places = placeIds.length
      ? checkRow(await supabase.from('places').select('*').in('id', placeIds)).map(toPlace)
      : [];
    return { trip: toTrip(tripRow), places, items, bookings, bucketItems, expenses };
  },
  async listDocuments() {
    const supabase = client();
    return checkRow(await supabase.from('documents').select('*').order('created_at')).map(
      toDocument,
    );
  },
  async saveDocument(document) {
    const supabase = client();
    const row = checkRow(
      await supabase
        .from('documents')
        .upsert({
          ...(document.id ? { id: document.id } : {}),
          type: document.type,
          country: document.country,
          number: document.number,
          expires_on: document.expiresOn,
          image_paths: document.imagePaths,
        })
        .select()
        .single(),
    );
    return toDocument(row);
  },
  async deleteDocument(id) {
    const supabase = client();
    check(await supabase.from('documents').delete().eq('id', id));
  },
  async saveItineraryItem(item) {
    const supabase = client();
    const row = checkRow(
      await supabase
        .from('itinerary_items')
        .upsert({
          id: item.id,
          trip_id: item.tripId,
          day: item.day,
          start_time: item.startTime,
          duration_minutes: item.durationMinutes,
          place_id: item.placeId,
          kind: item.kind,
          booking_id: item.bookingId,
          fixed: item.fixed,
          title: item.title || null,
          notes: item.notes || null,
        })
        .select()
        .single(),
    );
    return toItem(row);
  },
  async deleteItineraryItem(id) {
    const supabase = client();
    check(await supabase.from('itinerary_items').delete().eq('id', id));
  },
  async savePlace(place) {
    const supabase = client();
    const row = checkRow(
      await supabase
        .from('places')
        .upsert({
          ...(place.id ? { id: place.id } : {}),
          name: place.name,
          address: place.address,
          lat: place.lat,
          lng: place.lng,
          kind: place.kind,
          photo_url: place.photoUrl,
          source_url: place.sourceUrl,
        })
        .select()
        .single(),
    );
    return toPlace(row);
  },
  async saveBucketItem(item) {
    const supabase = client();
    const row = checkRow(
      await supabase
        .from('bucket_items')
        .upsert({
          id: item.id,
          trip_id: item.tripId,
          place_id: item.placeId,
          duration_minutes: item.durationMinutes,
          window_start: item.windowStart,
          window_end: item.windowEnd,
          source: item.source,
          fixed_date: item.fixedDate,
          fixed_time: item.fixedTime,
          title: item.title || null,
        })
        .select()
        .single(),
    );
    return toBucket(row);
  },
  async deleteBucketItem(id) {
    const supabase = client();
    check(await supabase.from('bucket_items').delete().eq('id', id));
  },
  async saveExpense(expense) {
    const supabase = client();
    const row = checkRow(
      await supabase
        .from('expenses')
        .upsert({
          id: expense.id,
          trip_id: expense.tripId,
          amount_minor: expense.amountMinor,
          currency: expense.currency,
          category: expense.category,
          booking_id: expense.bookingId,
          paid_at: expense.paidAt,
          description: expense.description ?? null,
        })
        .select()
        .single(),
    );
    return toExpense(row);
  },
  async saveTripBudget(tripId, budget) {
    const supabase = client();
    const row = checkRow(
      await supabase
        .from('trips')
        .update({
          budget_minor: budget?.amountMinor ?? null,
          budget_currency: budget?.currency ?? null,
        })
        .eq('id', tripId)
        .select()
        .single(),
    );
    return toTrip(row);
  },
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
