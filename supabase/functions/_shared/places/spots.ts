// Photon (komoot, OpenStreetMap data, no key) → places to go. Shared by the `places` function's
// spot search (TR-27) and `parse-link`, which locates the places a video names (TR-30).

/** A restaurant, bar, sight… found near the trip's city. */
export interface SpotResult {
  /** Stable id from OpenStreetMap, e.g. `N2287541093`. */
  id: string;
  name: string;
  /** The app's place kind (food, bar, nightlife, attraction, landmark, hotel, arena, airport). */
  kind: string | null;
  /** Neighbourhood or city ("Downtown", "Las Vegas"). */
  area: string | null;
  /** Street address with the city, when OpenStreetMap has one. */
  address: string | null;
  lat: number;
  lng: number;
}

export const PHOTON = 'https://photon.komoot.io/api/';
export const USER_AGENT = 'Trip demo app (https://github.com/MattSharp05/Trip)';

export interface PhotonFeature {
  geometry?: { coordinates?: [number, number] };
  properties?: {
    osm_type?: string;
    osm_id?: number;
    name?: string;
    state?: string;
    country?: string;
    countrycode?: string;
    osm_key?: string;
    osm_value?: string;
    housenumber?: string;
    street?: string;
    district?: string;
    locality?: string;
    city?: string;
  };
}

/** Spot searches only look this far (degrees) around the trip's city: about 50 km. */
export const NEAR_DEGREES = 0.5;

/** OpenStreetMap features that are areas or roads, not somewhere to go. */
const NOT_SPOTS = new Set(['place', 'highway', 'boundary', 'landuse', 'railway', 'waterway']);

/** OpenStreetMap `key=value` (or just `key`) → the app's place kind. */
const KINDS: Record<string, string> = {
  'amenity=restaurant': 'food',
  'amenity=fast_food': 'food',
  'amenity=cafe': 'food',
  'amenity=food_court': 'food',
  'amenity=ice_cream': 'food',
  'shop=bakery': 'food',
  'amenity=bar': 'bar',
  'amenity=pub': 'bar',
  'amenity=biergarten': 'bar',
  'amenity=nightclub': 'nightlife',
  'amenity=casino': 'nightlife',
  'amenity=theatre': 'attraction',
  'amenity=cinema': 'attraction',
  'amenity=arts_centre': 'attraction',
  'leisure=stadium': 'arena',
  'leisure=sports_centre': 'arena',
  'aeroway=aerodrome': 'airport',
  'tourism=hotel': 'hotel',
  'tourism=motel': 'hotel',
  'tourism=hostel': 'hotel',
  'tourism=viewpoint': 'landmark',
  historic: 'landmark',
  tourism: 'attraction',
  leisure: 'attraction',
};

export function spotKind(key: string | undefined, value: string | undefined): string | null {
  if (!key) return null;
  return KINDS[`${key}=${value}`] ?? KINDS[key] ?? null;
}

/** Photon features → spots: named places to go, with coordinates, without duplicates. */
export function toSpots(json: unknown): SpotResult[] {
  const features = (json as { features?: PhotonFeature[] } | null)?.features ?? [];
  const seen = new Set<string>();
  const spots: SpotResult[] = [];
  for (const f of features) {
    const p = f.properties ?? {};
    const [lng, lat] = f.geometry?.coordinates ?? [];
    if (!p.name || typeof lat !== 'number' || typeof lng !== 'number') continue;
    if (p.osm_key && NOT_SPOTS.has(p.osm_key)) continue;
    const city = p.city ?? p.locality ?? null;
    const key = [p.name, p.street ?? '', city ?? ''].join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    const street = [p.housenumber, p.street].filter(Boolean).join(' ');
    spots.push({
      id: `${p.osm_type ?? 'X'}${p.osm_id ?? spots.length}`,
      name: p.name,
      kind: spotKind(p.osm_key, p.osm_value),
      area: p.district ?? city,
      address: [street, city].filter(Boolean).join(', ') || null,
      lat,
      lng,
    });
  }
  return spots;
}
