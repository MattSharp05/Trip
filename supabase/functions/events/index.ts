// Edge Function `events` (TR-31, ADR 0018): what's on near a trip during its dates, for Discover.
//
// Request: POST EventsRequest ({ lat, lng, startDate, endDate }; see _shared/events/schema.ts).
// Response: { events: TripEvent[] } or { error: EventsErrorCode, message }.
//
// The provider is chosen by EVENTS_PROVIDER: `ticketmaster` (default, the Discovery API, needs
// TICKETMASTER_API_KEY) or `fixture` (deterministic Las Vegas demo events, no calls). Answers are
// kept in memory for 6 hours per area and dates, so travellers looking at the same city share one
// lookup while the function instance lives (no cache table: the free plan's 5,000 calls a day
// are plenty for a demo).
// Deno runs the file (`Deno.serve` below); Jest imports `handle` with stand-in fetch, env and clock.

import { fixtureEvents } from '../_shared/events/fixtures.ts';
import {
  eventsRequestSchema,
  type EventsErrorCode,
  type EventsRequest,
  type TripEvent,
} from '../_shared/events/schema.ts';
import {
  geohash,
  MAX_PAGES,
  ticketmasterEvents,
  ticketmasterUrl,
  type TmPage,
} from '../_shared/events/ticketmaster.ts';

export const CACHE_MS = 6 * 60 * 60 * 1000;
/** Most events one answer carries. */
export const MAX_EVENTS = 200;

export type Env = (name: string) => string | undefined;

export class EventsFailure extends Error {
  constructor(
    readonly code: EventsErrorCode,
    message: string,
  ) {
    super(message);
  }
}

const COPY: Record<EventsErrorCode, string> = {
  not_configured: 'Event listings are not set up yet.',
  invalid: "Send the trip's centre (lat, lng) and its start and end dates.",
  limit_reached: 'Event listings are busy. Try again in a minute.',
  failed: "Couldn't load events.",
};

const HTTP: Record<EventsErrorCode, number> = {
  not_configured: 503,
  invalid: 400,
  limit_reached: 429,
  failed: 502,
};

/** A source of events for a trip. */
export interface EventsProvider {
  readonly name: string;
  search(request: EventsRequest): Promise<TripEvent[]>;
}

/** Ticketmaster's Discovery API: up to MAX_PAGES pages of 100, stopping at the last page. */
export function ticketmasterProvider(apiKey: string, fetchImpl: typeof fetch): EventsProvider {
  return {
    name: 'ticketmaster',
    async search(request) {
      const pages: TmPage[] = [];
      for (let page = 0; page < MAX_PAGES; page++) {
        const res = await fetchImpl(ticketmasterUrl(apiKey, request, page));
        if (res.status === 429) throw new EventsFailure('limit_reached', COPY.limit_reached);
        if (!res.ok) throw new EventsFailure('failed', `Ticketmaster returned ${res.status}`);
        const body = (await res.json()) as TmPage;
        pages.push(body);
        const total = body.page?.totalPages ?? 0;
        if (page + 1 >= total) break;
      }
      return ticketmasterEvents(pages, request);
    },
  };
}

export const fixtureProvider: EventsProvider = {
  name: 'fixture',
  async search(request) {
    return fixtureEvents(request);
  },
};

export function chooseProvider(env: Env, fetchImpl: typeof fetch): EventsProvider {
  if (env('EVENTS_PROVIDER') === 'fixture') return fixtureProvider;
  const key = env('TICKETMASTER_API_KEY');
  if (!key) throw new EventsFailure('not_configured', COPY.not_configured);
  return ticketmasterProvider(key, fetchImpl);
}

// --- Cache -----------------------------------------------------------------------------------

interface Cached {
  events: TripEvent[];
  at: number;
}

/** In memory, per function instance. Keyed by provider, area (geohash, about 5 km) and dates. */
const cache = new Map<string, Cached>();

export function clearCache(): void {
  cache.clear();
}

const cacheKey = (provider: string, r: EventsRequest) =>
  `${provider}:${geohash(r.lat, r.lng, 5)}:${r.startDate}:${r.endDate}`;

// --- Handler ---------------------------------------------------------------------------------

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const fail = (code: EventsErrorCode, message = COPY[code]) =>
  json({ error: code, message }, HTTP[code]);

export interface Deps {
  env: Env;
  fetch: typeof fetch;
  now: () => Date;
}

export async function handle(req: Request, deps: Deps): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'invalid', message: 'Use POST' }, 405);
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail('invalid', 'Body must be JSON');
  }
  const parsed = eventsRequestSchema.safeParse(body);
  if (!parsed.success) return fail('invalid');
  const request = parsed.data;

  let provider: EventsProvider;
  try {
    provider = chooseProvider(deps.env, deps.fetch);
  } catch (error) {
    if (error instanceof EventsFailure) return fail(error.code, error.message);
    throw error;
  }

  const key = cacheKey(provider.name, request);
  const now = deps.now().getTime();
  const cached = cache.get(key);
  if (cached && now - cached.at < CACHE_MS) return json({ events: cached.events });

  try {
    const events = (await provider.search(request)).slice(0, MAX_EVENTS);
    cache.set(key, { events, at: now });
    return json({ events });
  } catch (error) {
    // An older answer beats none.
    if (cached) return json({ events: cached.events });
    if (error instanceof EventsFailure) {
      if (error.code === 'failed') console.error('events:', error.message);
      return fail(error.code, error.code === 'failed' ? COPY.failed : error.message);
    }
    console.error('events failed', error);
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
  deno.serve((req) =>
    handle(req, { env: (name) => deno.env.get(name), fetch, now: () => new Date() }),
  );
}
