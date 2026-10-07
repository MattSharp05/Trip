// Edge Function `parse-link` (TR-30, ADR 0019): finds the places a TikTok or Instagram Reel names.
//
// Request: POST { url, near?: { lat, lng }, city? } (the trip's city and its coordinates).
// Response: { result: LinkResult } or { error: LinkErrorCode, message } (see _shared/parse/links).
//
// 1. What the link says about itself: TikTok's public oEmbed (caption, creator, thumbnail), or an
//    Instagram post's Open Graph tags when Instagram serves them. No scraping (TDD).
// 2. The `ParseProvider` (_shared/parse/provider.ts) reads the caption's place names; PARSE_PROVIDER
//    `fixture` answers the sample videos (_shared/parse/linkFixtures.ts) without a model.
// 3. Photon locates each place near the trip (_shared/parse/locate.ts); unlocated ones stay in the
//    list without coordinates so the app can offer "Find it".
// The app saves what the traveller ticks (saved_links + bucket_items), so this function writes
// nothing. Deno runs it (`Deno.serve` below); Jest imports `handle` with stand-in fetch and env.

import { linkSampleFor } from '../_shared/parse/linkFixtures.ts';
import { fetchLinkMeta, NO_META, type LinkMeta } from '../_shared/parse/linkMeta.ts';
import {
  extractedPlacesSchema,
  LINK_ERROR_COPY,
  linkPlatform,
  type LinkErrorCode,
  type LinkResult,
} from '../_shared/parse/links.ts';
import { locatePlaces, type LngLat } from '../_shared/parse/locate.ts';
import {
  chooseProvider,
  ParseFailure,
  type Env,
  type ParseProvider,
} from '../_shared/parse/provider.ts';
import type { ParseErrorCode } from '../_shared/parse/schema.ts';

export type { Env };

const COPY = LINK_ERROR_COPY;
/** The provider's errors with this function's copy ("videos", not "bookings"). */
const PROVIDER_COPY: Record<ParseErrorCode, string> = COPY;

const STATUS: Record<LinkErrorCode, number> = {
  not_configured: 503,
  rate_limited: 429,
  unreadable: 422,
  failed: 502,
  unsupported: 400,
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const fail = (code: LinkErrorCode, message = COPY[code]) =>
  json({ error: code, message }, STATUS[code]);

export interface Deps {
  env: Env;
  fetch: typeof fetch;
}

interface LinkRequest {
  url: string;
  near: LngLat | null;
  city: string | null;
}

/** The request body, or null when it isn't one. */
export function readRequest(body: unknown): LinkRequest | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as {
    url?: unknown;
    near?: { lat?: unknown; lng?: unknown } | null;
    city?: unknown;
  };
  const url = typeof b.url === 'string' ? b.url.trim() : '';
  if (!url || url.length > 2048) return null;
  let near: LngLat | null = null;
  if (b.near) {
    const { lat, lng } = b.near;
    if (typeof lat !== 'number' || typeof lng !== 'number') return null;
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
    near = { lat, lng };
  }
  const city = typeof b.city === 'string' && b.city.trim() ? b.city.trim().slice(0, 100) : null;
  return { url, near, city };
}

export async function handle(req: Request, deps: Deps): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'failed', message: 'Use POST' }, 405);
  let request: LinkRequest | null;
  try {
    request = readRequest(await req.json());
  } catch {
    return json({ error: 'failed', message: 'Body must be JSON' }, 400);
  }
  if (!request) return json({ error: 'failed', message: 'Send { url, near?, city? }' }, 400);
  const { url, near, city } = request;
  const platform = linkPlatform(url);
  if (!platform) return fail('unsupported');

  let provider: ParseProvider;
  try {
    provider = chooseProvider(deps.env, deps.fetch, PROVIDER_COPY);
  } catch (error) {
    if (error instanceof ParseFailure) return fail(error.code, error.message);
    throw error;
  }

  try {
    const sample = provider.name === 'fixture' ? linkSampleFor(url) : null;
    const meta: LinkMeta =
      sample?.meta ?? (await fetchLinkMeta(url, platform, deps.fetch)) ?? NO_META;
    const result: LinkResult = { url, platform, ...meta, places: [] };
    // No caption (a private video, Instagram's login page): nothing to read, so search instead.
    if (!meta.title) return json({ result });

    const answer = await provider.extractPlaces(meta.title, city);
    const read = extractedPlacesSchema.safeParse(answer);
    if (!read.success) {
      console.warn(`parse-link: ${provider.name} answer failed validation`, read.error.issues);
      return json({ result });
    }
    if (sample) return json({ result: sample.result });
    const places = await locatePlaces(read.data.places.slice(0, 10), near, city, deps.fetch);
    return json({ result: { ...result, places } });
  } catch (error) {
    if (error instanceof ParseFailure) return fail(error.code, error.message);
    console.error('parse-link failed', error);
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
