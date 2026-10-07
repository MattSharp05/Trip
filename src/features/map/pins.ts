import type { SFSymbol } from 'expo-symbols';

import type { ItineraryItem, Place } from '@/services/data/types';

import type { MapPin } from './types';

/** What the map shows for one trip day. */
export interface DayPins {
  /** Every itinerary place of the trip, once each. */
  pins: MapPin[];
  /** The day's places in visit order (a place visited twice appears twice). */
  routeIds: string[];
  /** Places on other days only: drawn as grey dots. */
  dimmedIds: string[];
}

const byTime = (a: ItineraryItem, b: ItineraryItem) =>
  a.day.localeCompare(b.day) ||
  (a.startTime ?? '99:99').localeCompare(b.startTime ?? '99:99') ||
  a.id.localeCompare(b.id);

/**
 * The trip's map pins with `day` in focus: its places are full pins linked by the route, every
 * other itinerary place is a dot. Places without coordinates are left out.
 */
export function dayPins(
  { places, items }: { places: Place[]; items: ItineraryItem[] },
  day: string,
): DayPins {
  const placeById = new Map(places.map((p) => [p.id, p]));
  const pins = new Map<string, MapPin>();
  const routeIds: string[] = [];
  const onDay = new Set<string>();

  for (const item of [...items].sort(byTime)) {
    const place = item.placeId ? placeById.get(item.placeId) : undefined;
    if (!place || place.lat === null || place.lng === null) continue;
    const focused = item.day === day;
    // The day's first visit labels the pin ("Dinner at Carbone"); other days use the place name.
    if (!pins.has(place.id) || (focused && !onDay.has(place.id))) {
      pins.set(place.id, {
        id: place.id,
        coordinate: { lat: place.lat, lng: place.lng },
        kind: place.kind ?? item.kind,
        photo: place.photoUrl,
        label: (focused && item.title) || place.name,
      });
    }
    if (focused) {
      routeIds.push(place.id);
      onDay.add(place.id);
    }
  }

  const all = [...pins.values()];
  return {
    pins: all,
    routeIds,
    dimmedIds: all.filter((p) => !onDay.has(p.id)).map((p) => p.id),
  };
}

/** How a pin is drawn. */
export type PinStyle = 'photo' | 'symbol' | 'dot' | 'outline';

export function pinStyle(pin: MapPin, dimmed: boolean): PinStyle {
  if (pin.outlined) return 'outline';
  if (dimmed) return 'dot';
  return pin.photo ? 'photo' : 'symbol';
}

const SYMBOLS: Record<string, SFSymbol> = {
  food: 'fork.knife',
  landmark: 'building.columns',
  hotel: 'bed.double',
  airport: 'airplane',
  flight: 'airplane',
  car: 'car',
  arena: 'sportscourt',
  event: 'ticket',
  bar: 'wineglass',
  nightlife: 'music.note',
  attraction: 'star',
  activity: 'figure.walk',
};

/** The SF Symbol drawn on orange when a place has no photo. */
export function pinSymbol(kind: string): SFSymbol {
  return SYMBOLS[kind] ?? 'mappin';
}
