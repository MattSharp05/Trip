import { compareIds } from '@/core/split';

import { check, checkRow, client, currentUserId, hhmm, type Row } from '../shared/supabase';
import type { ItemKind, ItineraryItem, ItinerarySource } from './types';

/** What a trip's itinerary read embeds: who opted out of each stop (TR-60). */
export const ITEM_SELECT = '*, item_opt_outs(user_id)';

type ItemRow = Row<'itinerary_items'> & {
  item_opt_outs?: Pick<Row<'item_opt_outs'>, 'user_id'>[] | null;
};

export const toItem = (r: ItemRow): ItineraryItem => ({
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
  ...(r.item_opt_outs?.length
    ? { optedOut: r.item_opt_outs.map((o) => o.user_id).sort(compareIds) }
    : {}),
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
          // Unset, the database makes it the saver (new rows) or keeps it (existing ones).
          ...(item.addedBy ? { added_by: item.addedBy } : {}),
        })
        .select()
        .single(),
    );
    // The saved row carries no opt-outs; they're kept as they were.
    return { ...toItem(row), ...(item.optedOut?.length ? { optedOut: item.optedOut } : {}) };
  },
  async deleteItineraryItem(id) {
    const supabase = client();
    check(await supabase.from('itinerary_items').delete().eq('id', id));
  },
  async optOut(itemId, tripId) {
    const userId = await currentUserId();
    // `trip_id` is set from the stop by the database; an existing opt-out is left as it is.
    check(
      await client()
        .from('item_opt_outs')
        .upsert(
          { itinerary_item_id: itemId, user_id: userId, trip_id: tripId },
          { onConflict: 'itinerary_item_id,user_id', ignoreDuplicates: true },
        ),
    );
  },
  async optIn(itemId) {
    const userId = await currentUserId();
    check(
      await client()
        .from('item_opt_outs')
        .delete()
        .eq('itinerary_item_id', itemId)
        .eq('user_id', userId),
    );
  },
};
