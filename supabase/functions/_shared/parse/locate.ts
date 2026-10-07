// Puts the places a video names on the map (TR-30): Photon (OpenStreetMap, no key) near the trip,
// with two fallbacks. Never throws: a place Photon can't find comes back without coordinates and
// the app offers "Find it" (search) for it.

import { NEAR_DEGREES, PHOTON, toSpots, USER_AGENT, type SpotResult } from '../places/spots.ts';
import type { ExtractedPlace, LinkPlace } from './links.ts';

export interface LngLat {
  lat: number;
  lng: number;
}

/** A fallback match further than this from the trip's city is someone else's place. */
export const MAX_DISTANCE_KM = 60;

/** Great-circle distance in km. */
export function distanceKm(a: LngLat, b: LngLat): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/** "Esther’s Kitchen" → "estherskitchen": names compared without case, accents or punctuation. */
const simplify = (name: string) =>
  name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');

/**
 * Photon matches loosely ("Esther's Kitchen" finds "Rachel's Kitchen"), so a match must carry the
 * name the video gave, or the other way round ("Eggslut" ↔ "Eggslut Cosmopolitan").
 */
export function sameName(a: string, b: string): boolean {
  const x = simplify(a);
  const y = simplify(b);
  return x.length > 0 && y.length > 0 && (x.includes(y) || y.includes(x));
}

async function photon(
  name: string,
  query: string,
  near: LngLat | null,
  bounded: boolean,
  fetchImpl: typeof fetch,
): Promise<SpotResult[]> {
  try {
    const url = new URL(PHOTON);
    url.searchParams.set('q', query);
    url.searchParams.set('limit', '5');
    url.searchParams.set('lang', 'en');
    if (near) {
      url.searchParams.set('lat', String(near.lat));
      url.searchParams.set('lon', String(near.lng));
      if (bounded) {
        const d = NEAR_DEGREES;
        url.searchParams.set(
          'bbox',
          [near.lng - d, near.lat - d, near.lng + d, near.lat + d].join(','),
        );
      }
    }
    const res = await fetchImpl(url.toString(), { headers: { 'User-Agent': USER_AGENT } });
    if (!res.ok) return [];
    return toSpots(await res.json()).filter((s) => sameName(s.name, name));
  } catch {
    return [];
  }
}

/**
 * One place, matched by name (`sameName`): 1. its name inside the trip's area (about 50 km); 2. "name, city" anywhere, kept only
 * if it is within `MAX_DISTANCE_KM` of the trip; 3. not located. Without the trip's coordinates,
 * only "name, city" is tried.
 */
export async function locatePlace(
  place: ExtractedPlace,
  near: LngLat | null,
  tripCity: string | null,
  fetchImpl: typeof fetch,
): Promise<LinkPlace> {
  let spot: SpotResult | undefined;
  if (near) spot = (await photon(place.name, place.name, near, true, fetchImpl))[0];
  const city = place.city ?? tripCity;
  if (!spot && city) {
    const found = await photon(place.name, `${place.name}, ${city}`, near, false, fetchImpl);
    spot = found.find((s) => !near || distanceKm(near, s) <= MAX_DISTANCE_KM);
  }
  if (!spot) {
    return {
      name: place.name,
      kind: place.kind,
      area: place.city,
      address: null,
      lat: null,
      lng: null,
    };
  }
  return {
    name: spot.name,
    kind: spot.kind ?? place.kind,
    area: spot.area,
    address: spot.address,
    lat: spot.lat,
    lng: spot.lng,
  };
}

/** Every place, once each (by name), in the video's order. */
export async function locatePlaces(
  places: ExtractedPlace[],
  near: LngLat | null,
  tripCity: string | null,
  fetchImpl: typeof fetch,
): Promise<LinkPlace[]> {
  const seen = new Set<string>();
  const unique = places.filter((p) => {
    const key = p.name.trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return Promise.all(unique.map((p) => locatePlace(p, near, tripCity, fetchImpl)));
}
