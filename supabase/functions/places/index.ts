// Edge Function `places`: destination search for "create a trip" (TR-10) and spot search for the
// Bucket List (TR-27). Proxies Photon (komoot, OpenStreetMap data, no key) so the app never calls it
// directly and every request carries a proper User-Agent (Photon's fair-use terms).
// Cities: POST { query } → { places: PlaceResult[] }.
// Spots near a trip: POST { query, near: { lat, lng } } → { spots: SpotResult[] }.
//
// Deno runs it (`Deno.serve` below) and Jest imports `handle` to test it. The spot rules live in
// _shared/places/spots.ts (also used by `parse-link`).

import {
  NEAR_DEGREES,
  PHOTON,
  toSpots,
  USER_AGENT,
  type PhotonFeature,
} from '../_shared/places/spots.ts';

export { spotKind, toSpots, type SpotResult } from '../_shared/places/spots.ts';

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

const MAX_RESULTS = 8;

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
