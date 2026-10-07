import type { SFSymbol } from 'expo-symbols';

import { DEFAULT_WINDOW, durationForKind, kindLabel, sourceLabel } from '@/core/bucket';
import { dayLabel, timeLabel } from '@/core/dates';
import { newId } from '@/core/ids';
import { pinSymbol, type MapPin } from '@/features/map';
import type { BucketItem, Place, PlaceInput } from '@/services/data/types';
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
}

type BucketData = { places: Place[]; bucketItems: BucketItem[] };

/** The first part of an address, as the itinerary shows it ("Paris Las Vegas", "255 Sands Ave"). */
const area = (address: string | null) => address?.split(',')[0].trim() || null;

/** The trip's bucket items as rows, in the order they were saved. */
export function bucketEntries({ places, bucketItems }: BucketData): BucketEntry[] {
  const placeById = new Map(places.map((p) => [p.id, p]));
  return bucketItems.map((item) => {
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
      photo: place?.photoUrl ?? null,
      symbol: pinSymbol(place?.kind ?? 'bucket'),
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

/** A new bucket item for a saved place: default opening window and a visit length by kind. */
export function newBucketItem(
  tripId: string,
  place: Pick<Place, 'id' | 'kind'>,
  source: 'search' | 'pin',
  id: string = newId(),
): BucketItem {
  return {
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
