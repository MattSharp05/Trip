// Edge Function `parse-booking` (TR-25, ADR 0004): reads a booking (PDF or screenshot) the app
// uploaded to the private `originals` bucket and returns it as structured JSON.
//
// Request: POST { path } (a Storage path under the caller's own folder). The file is downloaded
// with the caller's own token, so Storage RLS decides what can be read.
// Response: { result: ParseResult } or { error: ParseErrorCode, message } (see _shared/parse).
//
// The model sits behind a `ParseProvider` (_shared/parse/provider.ts), chosen by the PARSE_PROVIDER
// secret: `gemini` (default, Gemini Flash free tier, needs GEMINI_API_KEY) or `fixture` (the canned
// sample parses, no model).
// Locations the model found are then geocoded with Photon (OpenStreetMap, no key). Deno runs the
// file (`Deno.serve` below); Jest imports `handle` with stand-in fetch and env to test it.

import {
  chooseProvider,
  ParseFailure,
  type Env,
  type ParseProvider,
} from '../_shared/parse/provider.ts';
import { normalizeAnswer } from '../_shared/parse/normalize.ts';
import {
  PARSE_ERROR_COPY,
  readParseResult,
  type ParseErrorCode,
  type ParseResult,
  type ParsedAirport,
  type ParsedLocation,
} from '../_shared/parse/schema.ts';

// The provider and the prompt moved to _shared/parse (TR-30 shares them); re-exported for callers.
export { BOOKING_PROMPT as PROMPT } from '../_shared/parse/prompts.ts';
export {
  chooseProvider,
  fixtureProvider,
  geminiProvider,
  ParseFailure,
  type BookingFile,
  type Env,
  type ParseProvider,
} from '../_shared/parse/provider.ts';

const BUCKET = 'originals';
const MAX_BYTES = 10 * 1024 * 1024;
const PHOTON = 'https://photon.komoot.io/api/';
const USER_AGENT = 'Trip demo app (https://github.com/MattSharp05/Trip)';

const COPY = PARSE_ERROR_COPY;

const STATUS: Record<ParseErrorCode, number> = {
  not_configured: 503,
  rate_limited: 429,
  unreadable: 422,
  failed: 502,
};

export function mimeTypeFor(path: string): string | null {
  const ext = path.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'pdf':
      return 'application/pdf';
    case 'png':
      return 'image/png';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'heic':
      return 'image/heic';
    case 'webp':
      return 'image/webp';
    default:
      return null;
  }
}

/** The first Photon match for a free-text query, or null. Geocoding never fails an import. */
async function geocode(
  query: string,
  fetchImpl: typeof fetch,
): Promise<{ lat: number; lng: number } | null> {
  try {
    const url = new URL(PHOTON);
    url.searchParams.set('q', query);
    url.searchParams.set('limit', '1');
    url.searchParams.set('lang', 'en');
    const res = await fetchImpl(url.toString(), { headers: { 'User-Agent': USER_AGENT } });
    if (!res.ok) return null;
    const body = (await res.json()) as { features?: { geometry?: { coordinates?: number[] } }[] };
    const [lng, lat] = body.features?.[0]?.geometry?.coordinates ?? [];
    return typeof lat === 'number' && typeof lng === 'number' ? { lat, lng } : null;
  } catch {
    return null;
  }
}

const mentions = (text: string, word: string) => text.toLowerCase().includes(word.toLowerCase());
/** A street-only address still needs its city to find the right one. */
const locationQuery = (l: ParsedLocation) => {
  const address =
    l.address && l.city && !mentions(l.address, l.city) ? `${l.address}, ${l.city}` : l.address;
  return [l.name, address ?? l.city, l.address ? null : l.country].filter(Boolean).join(', ');
};
const airportQuery = (a: ParsedAirport) =>
  [`${a.code} airport`, a.city, a.country].filter(Boolean).join(', ');

/** Fills in coordinates for every location and airport that has none. */
export async function geocodeResult(
  result: ParseResult,
  fetchImpl: typeof fetch,
): Promise<ParseResult> {
  // Each place is looked up once, however many legs it appears on.
  const cache = new Map<string, Promise<{ lat: number; lng: number } | null>>();
  const fill = async <T extends { lat: number | null; lng: number | null }>(
    target: T,
    query: string,
  ): Promise<T> => {
    if (target.lat !== null && target.lng !== null) return target;
    if (!cache.has(query)) cache.set(query, geocode(query, fetchImpl));
    const found = await cache.get(query)!;
    return found ? { ...target, ...found } : target;
  };
  const b = result.booking;
  switch (b.type) {
    case 'flight': {
      const legs = [];
      for (const leg of b.legs) {
        legs.push({
          ...leg,
          from: await fill(leg.from, airportQuery(leg.from)),
          to: await fill(leg.to, airportQuery(leg.to)),
        });
      }
      return { ...result, booking: { ...b, legs } };
    }
    case 'hotel':
      return { ...result, booking: { ...b, hotel: await fill(b.hotel, locationQuery(b.hotel)) } };
    case 'car':
      return {
        ...result,
        booking: {
          ...b,
          pickupLocation: await fill(b.pickupLocation, locationQuery(b.pickupLocation)),
          returnLocation: b.returnLocation
            ? await fill(b.returnLocation, locationQuery(b.returnLocation))
            : null,
        },
      };
    case 'ticket':
    case 'reservation':
      return { ...result, booking: { ...b, venue: await fill(b.venue, locationQuery(b.venue)) } };
  }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const fail = (code: ParseErrorCode, message = COPY[code]) =>
  json({ error: code, message }, STATUS[code]);

export interface Deps {
  env: Env;
  fetch: typeof fetch;
}

export async function handle(req: Request, deps: Deps): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'failed', message: 'Use POST' }, 405);
  let path = '';
  try {
    const body = (await req.json()) as { path?: unknown };
    path = typeof body.path === 'string' ? body.path.trim() : '';
  } catch {
    return json({ error: 'failed', message: 'Body must be JSON' }, 400);
  }
  const mimeType = mimeTypeFor(path);
  if (!path || path.includes('..') || !mimeType) {
    return json({ error: 'failed', message: 'path must be a PDF or image in originals' }, 400);
  }

  let provider: ParseProvider;
  try {
    provider = chooseProvider(deps.env, deps.fetch);
  } catch (error) {
    if (error instanceof ParseFailure) return fail(error.code, error.message);
    throw error;
  }

  // Download with the caller's own token: Storage RLS only lets them read their own folder.
  const supabaseUrl = deps.env('SUPABASE_URL');
  const anonKey = deps.env('SUPABASE_ANON_KEY');
  const auth = req.headers.get('Authorization');
  if (!supabaseUrl || !anonKey || !auth) return fail('failed', 'Sign in to import bookings.');
  const objectPath = path.split('/').map(encodeURIComponent).join('/');
  const file = await deps.fetch(
    `${supabaseUrl}/storage/v1/object/authenticated/${BUCKET}/${objectPath}`,
    { headers: { Authorization: auth, apikey: anonKey } },
  );
  if (!file.ok) return json({ error: 'failed', message: `File not found (${file.status})` }, 404);
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.length > MAX_BYTES) return fail('unreadable', 'That file is over 10 MB.');

  try {
    const answer = await provider.parse({ name: path.split('/').pop() ?? path, mimeType, bytes });
    const read = readParseResult(normalizeAnswer(answer));
    if (!read.ok) {
      console.warn(`parse-booking: ${provider.name} answer failed validation`, read.issues);
      // The issues name schema paths only (no booking content), so the accuracy run can say why.
      return json({ error: 'unreadable', message: COPY.unreadable, issues: read.issues }, 422);
    }
    return json({ result: await geocodeResult(read.result, deps.fetch) });
  } catch (error) {
    if (error instanceof ParseFailure) return fail(error.code, error.message);
    console.error('parse-booking failed', error);
    return fail('failed');
  }
}

declare const Deno:
  | {
      serve: (handler: (req: Request) => Promise<Response>) => void;
      env: { get: (name: string) => string | undefined };
    }
  | undefined;

if (typeof Deno !== 'undefined') {
  const deno = Deno;
  deno.serve((req) => handle(req, { env: (name) => deno.env.get(name), fetch }));
}
