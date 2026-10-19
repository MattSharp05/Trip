import type { SFSymbol } from 'expo-symbols';

import {
  DEFAULT_WINDOW,
  durationForKind,
  kindLabel,
  likeCount,
  sortBucket,
  sourceLabel,
  type BucketSort,
} from '@/core/bucket';
import { dayLabel, timeLabel } from '@/core/dates';
import { newId } from '@/core/ids';
import { pinSymbol, type MapPin } from '@/features/map';
import type { BucketItem, Member, Place, PlaceInput, SavedLink } from '@/services/data/types';
import type { SpotResult } from '@/services/places';

/** One Bucket List row, ready to draw. */
export interface BucketEntry {
  id: string;
  placeId: string;
  title: string;
  /** "3939 Spring Mountain Rd · Bar"; null when nothing is known. */
  subtitle: string | null;
  /** "Saved from TikTok", "From Discover · Sat, Nov 14, 8:00 PM". */
  source: string | null;
  photo: string | null;
  symbol: SFSymbol;
  /** The video it was saved from: the row shows a play button that opens it. */
  watch: { url: string; label: string } | null;
  /** "Added by Blake", "Added by you"; null on a trip you're alone on (TR-59). */
  addedBy: string | null;
  likes: number;
  likedByMe: boolean;
}

/** Who's on the trip, for "Added by" and your likes; absent while they load. */
export interface BucketEntryOptions {
  members?: readonly Member[];
  sort?: BucketSort;
}

type BucketData = { places: Place[]; bucketItems: BucketItem[] };

/** The first part of an address, as the itinerary shows it ("Paris Las Vegas", "255 Sands Ave"). */
const area = (address: string | null) => address?.split(',')[0].trim() || null;

/**
 * "Added by Blake" on a group trip; items with no adder (v1 fixtures) are yours. Null when you're
 * alone on the trip, or the adder has left it.
 */
function addedByLine(item: BucketItem, members: readonly Member[]): string | null {
  if (members.length < 2) return null;
  const me = members.find((m) => m.isMe);
  const adder = item.addedBy ? members.find((m) => m.id === item.addedBy) : me;
  if (!adder) return null;
  return `Added by ${adder.isMe ? 'you' : adder.name}`;
}

/**
 * The trip's bucket items as rows: newest first (Recent, the default) or most liked first
 * (Popular).
 */
export function bucketEntries(
  { places, bucketItems }: BucketData,
  { members = [], sort = 'recent' }: BucketEntryOptions = {},
): BucketEntry[] {
  const placeById = new Map(places.map((p) => [p.id, p]));
  const me = members.find((m) => m.isMe)?.id;
  return sortBucket(bucketItems, sort).map((item) => {
    const place = placeById.get(item.placeId);
    const when =
      item.fixedDate && item.fixedTime
        ? `${dayLabel(item.fixedDate)}, ${timeLabel(item.fixedTime)}`
        : null;
    return {
      id: item.id,
      placeId: item.placeId,
      title: item.title || place?.name || 'Saved place',
      subtitle:
        [area(place?.address ?? null), kindLabel(place?.kind ?? null)]
          .filter(Boolean)
          .join(' · ') || null,
      source: [sourceLabel(item.source), when].filter(Boolean).join(' · ') || null,
      photo: place?.photoUrl ?? item.link?.thumbnailUrl ?? null,
      symbol: pinSymbol(place?.kind ?? 'bucket'),
      watch: item.link
        ? {
            url: item.link.url,
            label: `Watch on ${item.link.platform === 'tiktok' ? 'TikTok' : 'Instagram'}`,
          }
        : null,
      addedBy: addedByLine(item, members),
      likes: likeCount(item),
      likedByMe: me !== undefined && (item.likedBy ?? []).includes(me),
    };
  });
}

/** The bucket list's places as outlined map pins. Places without coordinates are left out. */
export function bucketPins({ places, bucketItems }: BucketData): MapPin[] {
  const placeById = new Map(places.map((p) => [p.id, p]));
  const pins = new Map<string, MapPin>();
  for (const item of bucketItems) {
    const place = placeById.get(item.placeId);
    if (!place || place.lat === null || place.lng === null || pins.has(place.id)) continue;
    pins.set(place.id, {
      id: place.id,
      coordinate: { lat: place.lat, lng: place.lng },
      kind: place.kind ?? 'bucket',
      photo: null,
      label: item.title || place.name,
      outlined: true,
    });
  }
  return [...pins.values()];
}

/** A search result as a place to save. */
export function placeFromSpot(spot: SpotResult): PlaceInput {
  return {
    name: spot.name,
    address: spot.address,
    lat: spot.lat,
    lng: spot.lng,
    kind: spot.kind,
    photoUrl: null,
    sourceUrl: null,
  };
}

/** A dropped pin, named by the user, as a place to save. */
export function placeFromPin(name: string, coordinate: { lat: number; lng: number }): PlaceInput {
  return {
    name: name.trim(),
    address: null,
    lat: coordinate.lat,
    lng: coordinate.lng,
    kind: null,
    photoUrl: null,
    sourceUrl: null,
  };
}

/**
 * A new bucket item for a saved place: default opening window and a visit length by kind. Places
 * saved from a video (source `tiktok` / `instagram`) carry it, for "Watch".
 */
export function newBucketItem(
  tripId: string,
  place: Pick<Place, 'id' | 'kind'>,
  source: 'search' | 'pin' | SavedLink['platform'],
  id: string = newId(),
  link?: SavedLink,
): BucketItem {
  return {
    ...(link ? { link } : {}),
    id,
    tripId,
    placeId: place.id,
    durationMinutes: durationForKind(place.kind),
    windowStart: DEFAULT_WINDOW.start,
    windowEnd: DEFAULT_WINDOW.end,
    source,
    fixedDate: null,
    fixedTime: null,
  };
}
