// Edge Function `places`: destination search for "create a trip" (TR-10). Proxies Photon (komoot,
// OpenStreetMap data, no key) so the app never calls it directly and every request carries a proper
// User-Agent (Photon's fair-use terms). Request: POST { query }. Response: { places: PlaceResult[] }.
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
  };
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
  try {
    const body = (await req.json()) as { query?: unknown };
    query = typeof body.query === 'string' ? body.query.trim() : '';
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
  url.searchParams.set('layer', 'city');
  const res = await fetchImpl(url.toString(), { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) return json({ error: `Photon returned ${res.status}` }, 502);
  const places = toPlaces(await res.json()).slice(0, MAX_RESULTS);
  return json({ places }, 200, { 'Cache-Control': 'public, max-age=86400' });
}

declare const Deno: { serve: (handler: (req: Request) => Promise<Response>) => void } | undefined;

if (typeof Deno !== 'undefined') Deno.serve((req) => handle(req));
