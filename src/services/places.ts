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
