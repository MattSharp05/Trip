import { check, checkRow, client, hhmm, type Row } from '../shared/supabase';
import type { ItemKind, ItineraryItem, ItinerarySource } from './types';

export const toItem = (r: Row<'itinerary_items'>): ItineraryItem => ({
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
  addedBy: r.added_by ?? r.user_id,
  notes: r.notes,
});

/** The itinerary slice of the Supabase source. */
export const supabaseItinerary: ItinerarySource = {
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
};
