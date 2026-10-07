import type { SFSymbol } from 'expo-symbols';

import type {
  LinkPlace,
  LinkPlatform,
  LinkResult,
} from '../../../supabase/functions/_shared/parse/links';
import { kindLabel } from '@/core/bucket';
import { pinSymbol } from '@/features/map';
import type { PlaceInput, SavedLinkInput } from '@/services/data/types';
import type { SpotResult } from '@/services/places';

/** "TikTok", "Instagram". */
export const platformName = (platform: LinkPlatform) =>
  platform === 'tiktok' ? 'TikTok' : 'Instagram';

/** One place in the results sheet. */
export interface LinkRow {
  key: string;
  place: LinkPlace;
  /** Photon put it on the map; unlocated places offer "Find it" instead of a checkbox. */
  located: boolean;
  title: string;
  /** "Downtown · Food"; "Not found on the map" when unlocated. */
  subtitle: string;
  symbol: SFSymbol;
}

export function linkRow(key: string, place: LinkPlace): LinkRow {
  const located = place.lat !== null && place.lng !== null;
  return {
    key,
    place,
    located,
    title: place.name,
    subtitle: located
      ? [place.area, kindLabel(place.kind)].filter(Boolean).join(' · ') || 'On the map'
      : 'Not found on the map',
    symbol: pinSymbol(place.kind ?? 'bucket'),
  };
}

/** The function's places as rows, in the video's order. */
export function linkRows(result: LinkResult): LinkRow[] {
  return result.places.map((place, i) => linkRow(`place-${i}`, place));
}

/** Located places start ticked (the traveller unticks what they don't want). */
export function initialTicks(rows: LinkRow[]): Set<string> {
  return new Set(rows.filter((r) => r.located).map((r) => r.key));
}

/** A search result picked with "Find it" (or "Search") as a located place. */
export function linkPlaceFromSpot(spot: SpotResult): LinkPlace {
  return {
    name: spot.name,
    kind: spot.kind,
    area: spot.area,
    address: spot.address,
    lat: spot.lat,
    lng: spot.lng,
  };
}

/** A ticked place to save; its source is the video. */
export function placeFromLink(place: LinkPlace, url: string): PlaceInput {
  return {
    name: place.name,
    address: place.address,
    lat: place.lat,
    lng: place.lng,
    kind: place.kind,
    photoUrl: null,
    sourceUrl: url,
  };
}

/** The video as a saved link of the trip, with the places saved from it. */
export function savedLinkFrom(
  result: LinkResult,
  tripId: string,
  placeIds: string[],
): SavedLinkInput {
  return {
    tripId,
    url: result.url,
    platform: result.platform,
    title: result.title,
    author: result.author,
    thumbnailUrl: result.thumbnailUrl,
    placeIds,
  };
}
