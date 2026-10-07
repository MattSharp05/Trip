import { invokeFunction } from './functions';

/** A destination from the `places` Edge Function (Photon / OpenStreetMap). */
export interface PlaceResult {
  id: string;
  name: string;
  region: string | null;
  country: string | null;
  countryCode: string | null;
  lat: number;
  lng: number;
}

/** Cities matching what the user typed, best match first. */
export async function searchPlaces(query: string): Promise<PlaceResult[]> {
  const { places } = await invokeFunction<{ places: PlaceResult[] }>('places', { query });
  return places;
}

/** A restaurant, bar or sight from the `places` function's spot search. */
export interface SpotResult {
  id: string;
  name: string;
  /** food, bar, nightlife, attraction, landmark, hotel, arena, airport; null when unknown. */
  kind: string | null;
  /** Neighbourhood or city. */
  area: string | null;
  address: string | null;
  lat: number;
  lng: number;
}

/** Places to go matching what the user typed, within about 50 km of `near` (the trip's city). */
export async function searchSpots(
  query: string,
  near: { lat: number; lng: number },
): Promise<SpotResult[]> {
  const { spots } = await invokeFunction<{ spots: SpotResult[] }>('places', { query, near });
  return spots;
}
