import { bookingPlaceIds } from '../bookings/placeIds';
import { toBooking } from '../bookings/supabase';
import { toBucket } from '../bucket/supabase';
import { toExpense } from '../expenses/supabase';
import { toItem } from '../itinerary/supabase';
import { toLink } from '../links/supabase';
import { toPlace } from '../places/supabase';
import { check, checkRow, client, type Row } from '../shared/supabase';
import type { PhotoCredit, Trip, TripsSource } from './types';

export const toTrip = (r: Row<'trips'>): Trip => ({
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

/** The trips slice of the Supabase source. `getTripData` reads every trip table at once. */
export const supabaseTrips: TripsSource = {
  async listTrips() {
    const supabase = client();
    const rows = checkRow(await supabase.from('trips').select('*').order('start_date'));
    return rows.map(toTrip);
  },
  async createTrip(trip, id) {
    const supabase = client();
    const row = checkRow(
      await supabase
        .from('trips')
        .insert({
          ...(id ? { id } : {}),
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
  async deleteTrip(id) {
    const supabase = client();
    // Bookings, itinerary, Bucket List, expenses and saved links go with it (on delete cascade).
    check(await supabase.from('trips').delete().eq('id', id));
  },
  async getTripData(tripId) {
    const supabase = client();
    const tripRow = check(await supabase.from('trips').select('*').eq('id', tripId).maybeSingle());
    if (!tripRow) return null;
    const [items, bookings, bucketRows, expenses, links] = await Promise.all([
      supabase
        .from('itinerary_items')
        .select('*')
        .eq('trip_id', tripId)
        .order('day')
        .order('start_time'),
      supabase.from('bookings').select('*').eq('trip_id', tripId),
      supabase.from('bucket_items').select('*').eq('trip_id', tripId),
      supabase.from('expenses').select('*').eq('trip_id', tripId),
      supabase.from('saved_links').select('*').eq('trip_id', tripId),
    ]).then(
      ([i, b, k, e, l]) =>
        [
          checkRow(i).map(toItem),
          checkRow(b).map(toBooking),
          checkRow(k),
          checkRow(e).map(toExpense),
          new Map(checkRow(l).map((r) => [r.id, toLink(r)])),
        ] as const,
    );
    // Each bucket item saved from a video carries it, for "Watch".
    const bucketItems = bucketRows.map((r) => {
      const link = r.saved_link_id ? links.get(r.saved_link_id) : undefined;
      return { ...toBucket(r), ...(link ? { link } : {}) };
    });
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
};
