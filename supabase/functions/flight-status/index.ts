// Edge Function `flight-status` (TR-26, ADR 0017): a booked flight's live status on the day it
// flies, so the app can show "Delayed 25 min" or the new gate.
//
// Request: POST FlightStatusRequest (flight number, local departure date, departure airport,
// booked departure and arrival instants; see _shared/flightStatus/schema.ts).
// Response: { status: FlightStatus | null } or { error: FlightStatusErrorCode, message }.
//
// The provider is only asked inside the live window (24 h before the booked departure to 2 h after
// the booked arrival); answers are cached for 10 minutes per flight; every provider call reserves
// its units in a monthly counter first, and calls stop at 90% of the free allowance. Cache and
// counter are service-only tables (migration 0005), reached with the service role key. Only a
// signed-in user's request can spend the allowance; anyone with the anon key gets cached answers.
//
// The provider is chosen by FLIGHT_STATUS_PROVIDER: `aerodatabox` (default, AeroDataBox through
// RapidAPI, needs FLIGHT_STATUS_API_KEY) or `fixture` (deterministic demo statuses, no calls).
// Deno runs the file (`Deno.serve` below); Jest imports `handle` with stand-in fetch, env and clock.

import { fixtureFlightStatus } from '../_shared/flightStatus/fixtures.ts';
import {
  flightStatusRequestSchema,
  inStatusWindow,
  normalizeFlightNumber,
  type FlightState,
  type FlightStatus,
  type FlightStatusErrorCode,
  type FlightStatusRequest,
} from '../_shared/flightStatus/schema.ts';

const AERODATABOX_HOST = 'aerodatabox.p.rapidapi.com';
/** AeroDataBox's free Basic plan on RapidAPI: 400 units a month. */
const DEFAULT_MONTHLY_UNITS = 400;
/** "Flight Status (single day)" is a Tier 2 endpoint: 2 units a call. */
const DEFAULT_UNITS_PER_CALL = 2;
/** Calls stop once this share of the month's allowance is used. */
export const ALLOWANCE_SHARE = 0.9;
export const CACHE_MS = 10 * 60 * 1000;
/** The longest flight the window accepts, so a request can't stretch it. */
const MAX_FLIGHT_MS = 24 * 60 * 60 * 1000;
/** A local date's instants lie within 26 h of its noon UTC (time zones run from −12 to +14). */
const LOCAL_DATE_SPREAD_MS = 26 * 60 * 60 * 1000;

export type Env = (name: string) => string | undefined;

export class StatusFailure extends Error {
  constructor(
    readonly code: FlightStatusErrorCode,
    message: string,
  ) {
    super(message);
  }
}

const COPY: Record<FlightStatusErrorCode, string> = {
  not_configured: 'Live flight status is not set up yet.',
  outside_window: 'Live status starts 24 hours before departure.',
  limit_reached: "This month's live status allowance is used up.",
  signed_out: 'Sign in to see live flight status.',
  invalid: 'Send a flight number, date, airport and the booked times.',
  failed: "Couldn't get the flight's status.",
};

const HTTP: Record<FlightStatusErrorCode, number> = {
  not_configured: 503,
  outside_window: 422,
  limit_reached: 429,
  signed_out: 401,
  invalid: 400,
  failed: 502,
};

/** A live-status source. Returns null when it doesn't know the flight. */
export interface FlightStatusProvider {
  readonly name: string;
  /** What one lookup costs against the monthly allowance; 0 for the fixture. */
  readonly unitsPerCall: number;
  lookup(request: FlightStatusRequest): Promise<FlightStatus | null>;
}

// --- AeroDataBox -----------------------------------------------------------------------------

interface AdbTime {
  utc?: string;
  local?: string;
}

interface AdbMovement {
  airport?: { iata?: string };
  scheduledTime?: AdbTime;
  revisedTime?: AdbTime;
  runwayTime?: AdbTime;
  terminal?: string;
  gate?: string;
}

/** The fields we read from AeroDataBox's FlightContract. */
export interface AdbFlight {
  number?: string;
  status?: string;
  lastUpdatedUtc?: string;
  departure?: AdbMovement;
  arrival?: AdbMovement;
}

/** AeroDataBox writes `2026-11-12 14:05Z`; returns the ISO instant, or null. */
export function adbInstant(value: string | undefined): string | null {
  if (!value) return null;
  const ms = Date.parse(value.trim().replace(' ', 'T'));
  return Number.isNaN(ms) ? null : new Date(ms).toISOString();
}

const AIRBORNE = new Set(['Departed', 'EnRoute', 'Approaching']);

const STATES: Record<string, FlightState> = {
  Arrived: 'landed',
  Canceled: 'cancelled',
  // `CanceledUncertain` stays active: the provider isn't sure, and a wrong "Cancelled" is worse.
  Diverted: 'diverted',
};

const minutesLate = (scheduled: string | null, revised: string | null) =>
  scheduled && revised
    ? Math.max(0, Math.round((Date.parse(revised) - Date.parse(scheduled)) / 60_000))
    : 0;

const text = (value: string | undefined) => value?.trim() || null;

/**
 * One AeroDataBox flight as a FlightStatus. Before take-off the delay is the departure's, once
 * airborne the arrival's (when it has an estimate). `Unknown` (no live data) is null: the app shows the booking then.
 */
export function mapAeroDataBox(flight: AdbFlight, answeredAt: Date): FlightStatus | null {
  const status = flight.status ?? 'Unknown';
  if (status === 'Unknown') return null;
  const dep = flight.departure ?? {};
  const arr = flight.arrival ?? {};
  const depRevised = adbInstant(dep.revisedTime?.utc) ?? adbInstant(dep.runwayTime?.utc);
  const arrRevised = adbInstant(arr.revisedTime?.utc) ?? adbInstant(arr.runwayTime?.utc);
  const departureDelay = minutesLate(adbInstant(dep.scheduledTime?.utc), depRevised);
  // In the air, the arrival estimate says how late it will be; without one, the departure's.
  const delayMinutes =
    AIRBORNE.has(status) && arrRevised
      ? minutesLate(adbInstant(arr.scheduledTime?.utc), arrRevised)
      : departureDelay;
  return {
    state: STATES[status] ?? 'active',
    delayMinutes,
    departure: { terminal: text(dep.terminal), gate: text(dep.gate), revisedAt: depRevised },
    arrival: { terminal: text(arr.terminal), gate: text(arr.gate), revisedAt: arrRevised },
    updatedAt: adbInstant(flight.lastUpdatedUtc) ?? answeredAt.toISOString(),
  };
}

/** AeroDataBox's "Flight Status (single day)" through RapidAPI. */
export function aeroDataBoxProvider(
  apiKey: string,
  fetchImpl: typeof fetch,
  now: () => Date,
  unitsPerCall = DEFAULT_UNITS_PER_CALL,
): FlightStatusProvider {
  return {
    name: 'aerodatabox',
    unitsPerCall,
    async lookup(request) {
      const number = encodeURIComponent(normalizeFlightNumber(request.flightNumber));
      const url =
        `https://${AERODATABOX_HOST}/flights/number/${number}/${request.date}` +
        '?dateLocalRole=Departure&withAircraftImage=false&withLocation=false';
      const res = await fetchImpl(url, {
        headers: { 'X-RapidAPI-Key': apiKey, 'X-RapidAPI-Host': AERODATABOX_HOST },
      });
      // 204: no such flight that day (or none the provider covers).
      if (res.status === 204 || res.status === 404) return null;
      if (res.status === 429) throw new StatusFailure('limit_reached', COPY.limit_reached);
      if (!res.ok) throw new StatusFailure('failed', `AeroDataBox returned ${res.status}`);
      const flights = (await res.json()) as AdbFlight[];
      if (!Array.isArray(flights) || flights.length === 0) return null;
      // A flight number can fly several legs a day: take the one leaving the booked airport.
      const from = request.from.toUpperCase();
      const leg = flights.find((f) => f.departure?.airport?.iata?.toUpperCase() === from);
      return leg ? mapAeroDataBox(leg, now()) : null;
    },
  };
}

/** Deterministic demo statuses: AA 2410 runs late from a new gate, everything else is on time. */
export const fixtureProvider: FlightStatusProvider = {
  name: 'fixture',
  unitsPerCall: 0,
  async lookup(request) {
    return fixtureFlightStatus(request, true);
  },
};

export function chooseProvider(env: Env, fetchImpl: typeof fetch, now: () => Date) {
  if (env('FLIGHT_STATUS_PROVIDER') === 'fixture') return fixtureProvider;
  const key = env('FLIGHT_STATUS_API_KEY');
  if (!key) throw new StatusFailure('not_configured', COPY.not_configured);
  return aeroDataBoxProvider(key, fetchImpl, now, positive(env('FLIGHT_STATUS_UNITS_PER_CALL')));
}

function positive(value: string | undefined): number | undefined {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : undefined;
}

// --- Cache and monthly counter (service-only tables, migration 0005) --------------------------

export interface CachedStatus {
  status: FlightStatus | null;
  fetchedAt: Date;
}

/** The cache and the allowance counter, through PostgREST with the service role key. */
export interface StatusStore {
  read(key: string): Promise<CachedStatus | null>;
  write(key: string, status: FlightStatus | null, at: Date): Promise<void>;
  /** Adds `units` to the month's count unless that would pass `limit`; false means "stop". */
  reserve(month: string, units: number, limit: number): Promise<boolean>;
}

export function supabaseStore(url: string, serviceKey: string, fetchImpl: typeof fetch) {
  const headers = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
  };
  const store: StatusStore = {
    async read(key) {
      const res = await fetchImpl(
        `${url}/rest/v1/flight_status_cache?key=eq.${encodeURIComponent(key)}&select=status,fetched_at`,
        { headers },
      );
      if (!res.ok) return null;
      const rows = (await res.json()) as { status: FlightStatus | null; fetched_at: string }[];
      const row = rows[0];
      return row ? { status: row.status, fetchedAt: new Date(row.fetched_at) } : null;
    },
    async write(key, status, at) {
      await fetchImpl(`${url}/rest/v1/flight_status_cache`, {
        method: 'POST',
        headers: { ...headers, Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify({ key, status, fetched_at: at.toISOString() }),
      });
    },
    async reserve(month, units, limit) {
      const res = await fetchImpl(`${url}/rest/v1/rpc/reserve_flight_status_units`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ p_month: month, p_units: units, p_limit: limit }),
      });
      // If the counter can't be reached, don't spend the allowance blind.
      if (!res.ok) return false;
      return (await res.json()) === true;
    },
  };
  return store;
}

/** The month's unit budget: 90% of the allowance, rounded down. */
export function unitLimit(env: Env): number {
  const allowance = positive(env('FLIGHT_STATUS_MONTHLY_UNITS')) ?? DEFAULT_MONTHLY_UNITS;
  return Math.floor(allowance * ALLOWANCE_SHARE);
}

// --- Handler ---------------------------------------------------------------------------------

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const fail = (code: FlightStatusErrorCode, message = COPY[code]) =>
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
  const parsed = flightStatusRequestSchema.safeParse(body);
  if (!parsed.success) return fail('invalid');
  const request = parsed.data;
  const departsAt = new Date(request.departsAt);
  const arrivesAt = new Date(request.arrivesAt);
  const length = arrivesAt.getTime() - departsAt.getTime();
  if (length <= 0 || length > MAX_FLIGHT_MS) return fail('invalid');
  // The booked times must belong to the date asked about, so the window can't be moved.
  const noon = Date.parse(`${request.date}T12:00:00Z`);
  if (Math.abs(departsAt.getTime() - noon) > LOCAL_DATE_SPREAD_MS) return fail('invalid');

  const now = deps.now();
  if (!inStatusWindow(departsAt, arrivesAt, now)) return fail('outside_window');

  let provider: FlightStatusProvider;
  try {
    provider = chooseProvider(deps.env, deps.fetch, deps.now);
  } catch (error) {
    if (error instanceof StatusFailure) return fail(error.code, error.message);
    throw error;
  }
  if (provider.unitsPerCall === 0) return json({ status: await provider.lookup(request) });

  const supabaseUrl = deps.env('SUPABASE_URL');
  const serviceKey = deps.env('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) return fail('failed', 'The status cache is not reachable.');
  const store = supabaseStore(supabaseUrl, serviceKey, deps.fetch);

  const key = `${normalizeFlightNumber(request.flightNumber)}:${request.date}:${request.from.toUpperCase()}`;
  let cached: CachedStatus | null = null;
  try {
    cached = await store.read(key);
    if (cached && now.getTime() - cached.fetchedAt.getTime() < CACHE_MS) {
      return json({ status: cached.status });
    }

    // Only signed-in travellers spend the allowance (the anon key ships in the app).
    if (!(await isSignedIn(req, supabaseUrl, deps))) return fail('signed_out');

    const month = now.toISOString().slice(0, 7);
    if (!(await store.reserve(month, provider.unitsPerCall, unitLimit(deps.env)))) {
      // Out of allowance: an older answer beats none.
      return cached ? json({ status: cached.status }) : fail('limit_reached');
    }

    const status = await provider.lookup(request);
    // A failed cache write still answers: the units are spent either way.
    await store.write(key, status, now).catch((error: unknown) => {
      console.error('flight-status: cache write failed', error);
    });
    return json({ status });
  } catch (error) {
    if (error instanceof StatusFailure) return fail(error.code, error.message);
    console.error('flight-status failed', error);
    return cached ? json({ status: cached.status }) : fail('failed');
  }
}

/** True when the caller's token is a signed-in user's (not just the anon key). */
async function isSignedIn(req: Request, supabaseUrl: string, deps: Deps): Promise<boolean> {
  const auth = req.headers.get('Authorization');
  const anonKey = deps.env('SUPABASE_ANON_KEY');
  if (!auth || !anonKey) return false;
  const res = await deps.fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { Authorization: auth, apikey: anonKey },
  });
  return res.ok;
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
