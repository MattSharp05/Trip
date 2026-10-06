import type { DataSnapshot, ItineraryItem, Place } from '@/services/data/types';

import { VEGAS_TRIP_ID, vegasSnapshot } from './vegas';

/** Fri, Nov 13: the day the crowded map focuses on. */
export const CROWDED_DAY = '2026-11-13';
/** Pins on the crowded day, for the map's performance check (TR-13). */
export const CROWDED_PINS = 40;

const KINDS = ['food', 'landmark', 'bar', 'attraction', 'nightlife', 'arena'];

/**
 * The Vegas account with 36 extra stops on Fri, Nov 13 (40 in all), scattered around the Strip
 * with a fixed seed: same data every run. Every other place keeps its photo or symbol, so the map
 * draws a mix.
 */
function crowded(): DataSnapshot {
  const photos = vegasSnapshot.places.flatMap((p) => p.photoUrl ?? []);
  const onDay = vegasSnapshot.items.filter((i) => i.day === CROWDED_DAY).length;
  let seed = 7;
  const next = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };

  const places: Place[] = [];
  const items: ItineraryItem[] = [];
  for (let i = 1; i <= CROWDED_PINS - onDay; i++) {
    const id = `place-extra-${String(i).padStart(2, '0')}`;
    places.push({
      id,
      name: `Saved place ${i}`,
      address: null,
      lat: 36.095 + next() * 0.04,
      lng: -115.185 + next() * 0.035,
      kind: KINDS[i % KINDS.length],
      photoUrl: i % 2 ? photos[i % photos.length] : null,
      sourceUrl: null,
    });
    const minutes = 8 * 60 + i * 20;
    items.push({
      id: `item-extra-${String(i).padStart(2, '0')}`,
      tripId: VEGAS_TRIP_ID,
      day: CROWDED_DAY,
      startTime: `${String(Math.floor(minutes / 60) % 24).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`,
      durationMinutes: 15,
      placeId: id,
      kind: 'activity',
      bookingId: null,
      fixed: false,
      title: `Saved place ${i}`,
    });
  }

  return {
    ...vegasSnapshot,
    places: [...vegasSnapshot.places, ...places],
    items: [...vegasSnapshot.items, ...items],
  };
}

export const vegasCrowdedSnapshot = crowded();
