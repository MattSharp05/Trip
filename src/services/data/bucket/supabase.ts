import { check, checkRow, client, currentUserId, hhmm, type Row } from '../shared/supabase';
import type { BucketItem, BucketSource } from './types';

/** What a bucket item read embeds: who liked it (`select('*, bucket_likes(user_id)')`, TR-59). */
export const BUCKET_SELECT = '*, bucket_likes(user_id)';

type BucketRow = Row<'bucket_items'> & {
  bucket_likes?: Pick<Row<'bucket_likes'>, 'user_id'>[] | null;
};

/** A bucket item row without its link; `getTripData` joins `saved_link_id` to the link. */
export const toBucket = (r: BucketRow): BucketItem => ({
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
  addedBy: r.user_id,
  ...(r.bucket_likes?.length ? { likedBy: r.bucket_likes.map((l) => l.user_id).sort() } : {}),
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
    return {
      ...toBucket(row),
      ...(item.link ? { link: item.link } : {}),
      ...(item.likedBy?.length ? { likedBy: item.likedBy } : {}),
    };
  },
  async deleteBucketItem(id) {
    const supabase = client();
    check(await supabase.from('bucket_items').delete().eq('id', id));
  },
  async likeBucketItem(item) {
    const supabase = client();
    // `trip_id` is overwritten from the item by the table's trigger; RLS needs you on the trip.
    check(
      await supabase
        .from('bucket_likes')
        .upsert(
          { bucket_item_id: item.id, trip_id: item.tripId },
          { onConflict: 'bucket_item_id,user_id', ignoreDuplicates: true },
        ),
    );
  },
  async unlikeBucketItem(itemId) {
    const supabase = client();
    const me = await currentUserId();
    check(
      await supabase.from('bucket_likes').delete().eq('bucket_item_id', itemId).eq('user_id', me),
    );
  },
};
