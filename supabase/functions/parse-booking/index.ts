// Edge Function `parse-booking` (TR-25, ADR 0004): reads a booking (PDF or screenshot) the app
// uploaded to the private `originals` bucket and returns it as structured JSON.
//
// Request: POST { path } (a Storage path under the caller's own folder). The file is downloaded
// with the caller's own token, so Storage RLS decides what can be read.
// Response: { result: ParseResult } or { error: ParseErrorCode, message } (see _shared/parse).
//
// The model sits behind a `ParseProvider`, chosen by the PARSE_PROVIDER secret: `gemini` (default,
// Gemini Flash free tier, needs GEMINI_API_KEY) or `fixture` (the canned sample parses, no model).
// Locations the model found are then geocoded with Photon (OpenStreetMap, no key). Deno runs the
// file (`Deno.serve` below); Jest imports `handle` with stand-in fetch and env to test it.

import { sampleFor, SAMPLE_PARSES } from '../_shared/parse/fixtures.ts';
import {
  PARSE_ERROR_COPY,
  readParseResult,
  type ParseErrorCode,
  type ParseResult,
  type ParsedAirport,
  type ParsedLocation,
} from '../_shared/parse/schema.ts';

const BUCKET = 'originals';
const MAX_BYTES = 10 * 1024 * 1024;
const GEMINI = 'https://generativelanguage.googleapis.com/v1beta/models';
const DEFAULT_MODEL = 'gemini-flash-latest';
const PHOTON = 'https://photon.komoot.io/api/';
const USER_AGENT = 'Trip demo app (https://github.com/MattSharp05/Trip)';

export interface BookingFile {
  name: string;
  mimeType: string;
  bytes: Uint8Array;
}

/** A model that reads a booking file. Throws `ParseFailure` for the errors the app shows. */
export interface ParseProvider {
  readonly name: string;
  parse(file: BookingFile): Promise<unknown>;
}

export class ParseFailure extends Error {
  constructor(
    readonly code: ParseErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export type Env = (name: string) => string | undefined;

const COPY = PARSE_ERROR_COPY;

const STATUS: Record<ParseErrorCode, number> = {
  not_configured: 503,
  rate_limited: 429,
  unreadable: 422,
  failed: 502,
};

export const PROMPT = `You read travel bookings (confirmation emails saved as PDF, screenshots of apps).
Return one JSON object, nothing else: { "booking": <booking>, "uncertain": [<paths>] }.
<booking> is exactly one of these shapes ("type" decides which):
- {"type":"flight","confirmation","passenger","legs":[{"airline","airlineCode","flightNumber","from":{"code","city","country"},"to":{"code","city","country"},"departs":{"date","time"},"arrives":{"date","time"},"terminal","gate","seat","cabin"}],"price"}
- {"type":"hotel","hotel":{"name","address","city","country"},"checkIn":{"date","time"},"checkOut":{"date","time"},"confirmation","room","phone","website","email","price"}
- {"type":"car","company","pickupLocation":{"name","address","city","country"},"returnLocation":<same shape, or null when returned where picked up>,"pickup":{"date","time"},"dropoff":{"date","time"},"confirmation","vehicle","price"}
- {"type":"ticket","event","venue":{"name","address","city","country"},"starts":{"date","time"},"section","row","seats","confirmation","price"}
- {"type":"reservation","venue":{"name","address","city","country"},"starts":{"date","time"},"partySize","confirmation","price"}
Rules: dates YYYY-MM-DD; times HH:MM 24-hour, local time where it happens; airport codes are 3-letter IATA; flightNumber as printed with the airline code ("AA 2410"); list every flight leg in order, including the return; "price" is {"amount": number in major units like 412.30, "currency": ISO code} for the total paid, or null; partySize is a number or null. Use null for anything the booking doesn't say; never guess a value. Restaurants and other table bookings are "reservation"; concerts, games and shows are "ticket".
"uncertain" lists the paths of fields you are unsure about, like "checkIn.time" or "legs.0.seat".`;

/** Gemini Flash on the free tier (prompts may be used by Google; the app says so). */
export function geminiProvider(
  apiKey: string,
  model: string,
  fetchImpl: typeof fetch,
): ParseProvider {
  return {
    name: 'gemini',
    async parse(file) {
      const res = await fetchImpl(`${GEMINI}/${model}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { inline_data: { mime_type: file.mimeType, data: toBase64(file.bytes) } },
                { text: PROMPT },
              ],
            },
          ],
          generationConfig: { responseMimeType: 'application/json', temperature: 0 },
        }),
      });
      if (res.status === 429) throw new ParseFailure('rate_limited', COPY.rate_limited);
      if (!res.ok) throw new ParseFailure('failed', `Gemini returned ${res.status}`);
      const body = (await res.json()) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
      };
      const answer = body.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('');
      if (!answer) throw new ParseFailure('unreadable', COPY.unreadable);
      try {
        return JSON.parse(answer);
      } catch {
        throw new ParseFailure('unreadable', COPY.unreadable);
      }
    },
  };
}

/** The canned sample parses, picked by file name; no model, no key. */
export const fixtureProvider: ParseProvider = {
  name: 'fixture',
  async parse(file) {
    return JSON.parse(JSON.stringify(SAMPLE_PARSES[sampleFor(file.name)]));
  },
};

export function chooseProvider(env: Env, fetchImpl: typeof fetch): ParseProvider {
  if (env('PARSE_PROVIDER') === 'fixture') return fixtureProvider;
  const key = env('GEMINI_API_KEY');
  if (!key) throw new ParseFailure('not_configured', COPY.not_configured);
  return geminiProvider(key, env('GEMINI_MODEL') || DEFAULT_MODEL, fetchImpl);
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

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

const locationQuery = (l: ParsedLocation) =>
  [l.name, l.address ?? l.city, l.address ? null : l.country].filter(Boolean).join(', ');
const airportQuery = (a: ParsedAirport) =>
  [`${a.code} airport`, a.city, a.country].filter(Boolean).join(', ');

/** Fills in coordinates for every location and airport that has none. */
export async function geocodeResult(
  result: ParseResult,
  fetchImpl: typeof fetch,
): Promise<ParseResult> {
  const fill = async <T extends { lat: number | null; lng: number | null }>(
    target: T,
    query: string,
  ): Promise<T> => {
    if (target.lat !== null && target.lng !== null) return target;
    const found = await geocode(query, fetchImpl);
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
    const read = readParseResult(answer);
    if (!read.ok) {
      console.warn(`parse-booking: ${provider.name} answer failed validation`, read.issues);
      return fail('unreadable');
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
