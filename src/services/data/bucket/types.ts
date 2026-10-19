import type { SavedLink } from '../links/types';

export interface BucketItem {
  id: string;
  tripId: string;
  placeId: string;
  durationMinutes: number | null;
  /** Opening window; an end before the start runs past midnight (bars). */
  windowStart: string | null;
  windowEnd: string | null;
  /** Where it came from: tiktok, instagram, search, discover. */
  source: string | null;
  /** Events have a fixed date and time. */
  fixedDate: string | null;
  fixedTime: string | null;
  /** Display title (an event's name); without one, screens show the place's name. */
  title?: string;
  /** Who added it (profile id); absent in v1 fixtures, meaning you. */
  addedBy?: string;
  /** The video it was saved from, for "Watch" (absent in most fixtures). */
  link?: SavedLink | null;
  /** Who liked it (profile ids, TR-59); absent means nobody. */
  likedBy?: string[];
}

/** The Bucket List slice of `DataSource`. */
export interface BucketSource {
  /** Saves a bucket item, with `saved_link_id` from `item.link`. */
  saveBucketItem(item: BucketItem): Promise<BucketItem>;
  deleteBucketItem(id: string): Promise<void>;
  /** Likes the item as you (TR-59); liking it twice is a no-op. */
  likeBucketItem(item: Pick<BucketItem, 'id' | 'tripId'>): Promise<void>;
  unlikeBucketItem(itemId: string): Promise<void>;
}
