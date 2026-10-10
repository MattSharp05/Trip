import { check, checkRow, client, hhmm, type Row } from '../shared/supabase';
import type { BucketItem, BucketSource } from './types';

/** A bucket item row without its link; `getTripData` joins `saved_link_id` to the link. */
export const toBucket = (r: Row<'bucket_items'>): BucketItem => ({
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

/** The Bucket List slice of the Supabase source. */
export const supabaseBucket: BucketSource = {
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
          saved_link_id: item.link?.id ?? null,
        })
        .select()
        .single(),
    );
    return { ...toBucket(row), ...(item.link ? { link: item.link } : {}) };
  },
  async deleteBucketItem(id) {
    const supabase = client();
    check(await supabase.from('bucket_items').delete().eq('id', id));
  },
};
