// Edge Function `places`: destination search for "create a trip" (TR-10) and spot search for the
// Bucket List (TR-27). Proxies Photon (komoot, OpenStreetMap data, no key) so the app never calls it
// directly and every request carries a proper User-Agent (Photon's fair-use terms).
// Cities: POST { query } → { places: PlaceResult[] }.
// Spots near a trip: POST { query, near: { lat, lng } } → { spots: SpotResult[] }.
//
// One self-contained file: Deno runs it (`Deno.serve` below) and Jest imports `handle` to test it.

export interface PlaceResult {
  /** Stable id from OpenStreetMap, e.g. `R5400890`. */
  id: string;
  name: string;
  /** State, province or region, when Photon has one. */
  region: string | null;
  country: string | null;
  countryCode: string | null;
  lat: number;
  lng: number;
}

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

const PHOTON = 'https://photon.komoot.io/api/';
const USER_AGENT = 'Trip demo app (https://github.com/MattSharp05/Trip)';
const MAX_RESULTS = 8;

interface PhotonFeature {
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
const NEAR_DEGREES = 0.5;

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

/** Photon features → places: cities only, named, with coordinates, without duplicates. */
export function toPlaces(json: unknown): PlaceResult[] {
  const features = (json as { features?: PhotonFeature[] } | null)?.features ?? [];
  const seen = new Set<string>();
  const places: PlaceResult[] = [];
  for (const f of features) {
    const p = f.properties ?? {};
    const [lng, lat] = f.geometry?.coordinates ?? [];
    if (!p.name || typeof lat !== 'number' || typeof lng !== 'number') continue;
    const key = [p.name, p.state ?? '', p.country ?? ''].join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    places.push({
      id: `${p.osm_type ?? 'X'}${p.osm_id ?? places.length}`,
      name: p.name,
      region: p.state ?? null,
      country: p.country ?? null,
      countryCode: p.countrycode?.toUpperCase() ?? null,
      lat,
      lng,
    });
  }
  return places;
}

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

export async function handle(req: Request, fetchImpl: typeof fetch = fetch): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'Use POST' }, 405);
  let query = '';
  let near: { lat: number; lng: number } | null = null;
  try {
    const body = (await req.json()) as { query?: unknown; near?: { lat?: unknown; lng?: unknown } };
    query = typeof body.query === 'string' ? body.query.trim() : '';
    const { lat, lng } = body.near ?? {};
    if (body.near !== undefined) {
      if (typeof lat !== 'number' || typeof lng !== 'number' || Math.abs(lat) > 90) {
        return json({ error: 'near must be { lat, lng } in degrees' }, 400);
      }
      near = { lat, lng };
    }
  } catch {
    return json({ error: 'Body must be JSON' }, 400);
  }
  if (query.length < 2 || query.length > 100) {
    return json({ error: 'query must be 2 to 100 characters' }, 400);
  }

  const url = new URL(PHOTON);
  url.searchParams.set('q', query);
  url.searchParams.set('limit', String(MAX_RESULTS + 4));
  url.searchParams.set('lang', 'en');
  if (near) {
    url.searchParams.set('lat', String(near.lat));
    url.searchParams.set('lon', String(near.lng));
    url.searchParams.set(
      'bbox',
      [
        near.lng - NEAR_DEGREES,
        near.lat - NEAR_DEGREES,
        near.lng + NEAR_DEGREES,
        near.lat + NEAR_DEGREES,
      ].join(','),
    );
  } else {
    url.searchParams.set('layer', 'city');
  }
  const res = await fetchImpl(url.toString(), { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) return json({ error: `Photon returned ${res.status}` }, 502);
  const body = await res.json();
  const cache = { 'Cache-Control': 'public, max-age=86400' };
  if (near) return json({ spots: toSpots(body).slice(0, MAX_RESULTS) }, 200, cache);
  return json({ places: toPlaces(body).slice(0, MAX_RESULTS) }, 200, cache);
}

declare const Deno: { serve: (handler: (req: Request) => Promise<Response>) => void } | undefined;

if (typeof Deno !== 'undefined') Deno.serve((req) => handle(req));
