import { inStatusWindow, WINDOW_AFTER_MS, WINDOW_BEFORE_MS } from '../_shared/flightStatus/schema';
import adbCancelled from './fixtures/adb-cancelled.json';
import adbDelayed from './fixtures/adb-delayed.json';
import adbGateChange from './fixtures/adb-gate-change.json';
import adbLanded from './fixtures/adb-landed.json';
import adbOnTime from './fixtures/adb-on-time.json';
import adbTwoLegs from './fixtures/adb-two-legs.json';
import { adbInstant, handle, mapAeroDataBox, unitLimit, type AdbFlight, type Env } from './index';

// Recorded-format AeroDataBox answers only (fixtures/): no live provider calls in CI. The cache
// and the allowance counter run against an in-memory stand-in for PostgREST that follows the
// migration's rules (0005_flight_status.sql).

const ENV: Record<string, string> = {
  FLIGHT_STATUS_API_KEY: 'test-key',
  SUPABASE_URL: 'https://project.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service',
};

const envOf =
  (overrides: Record<string, string | undefined> = {}): Env =>
  (name) =>
    name in overrides ? overrides[name] : ENV[name];

/** AA 2410, Tampa 9:05 AM EST → Las Vegas 11:02 AM PST, Thu Nov 12 2026. */
const AA2410 = {
  flightNumber: 'AA 2410',
  date: '2026-11-12',
  from: 'TPA',
  departsAt: '2026-11-12T14:05:00.000Z',
  arrivesAt: '2026-11-12T19:02:00.000Z',
};
/** 7:30 AM in Tampa on the day: inside the window. */
const MORNING = new Date('2026-11-12T12:30:00Z');

const respond = (body: unknown, status = 200) =>
  status === 204
    ? new Response(null, { status })
    : new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
      });

interface Db {
  cache: Map<string, { status: unknown; fetched_at: string }>;
  units: Map<string, number>;
}

/** A fetch serving AeroDataBox (one recorded answer) and PostgREST (the cache and counter). */
function fakeFetch(provider: { body: unknown; status?: number }, db: Db = newDb()) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const impl = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init });
    if (url.includes('aerodatabox')) return respond(provider.body, provider.status);
    if (url.includes('/rest/v1/flight_status_cache?')) {
      const key = decodeURIComponent(new URL(url).searchParams.get('key')!.replace(/^eq\./, ''));
      const row = db.cache.get(key);
      return respond(row ? [row] : []);
    }
    if (url.endsWith('/rest/v1/flight_status_cache')) {
      const { key, status, fetched_at } = JSON.parse(String(init?.body));
      db.cache.set(key, { status, fetched_at });
      return respond(null, 204);
    }
    if (url.endsWith('/rest/v1/rpc/reserve_flight_status_units')) {
      const { p_month, p_units, p_limit } = JSON.parse(String(init?.body));
      const used = db.units.get(p_month) ?? 0;
      if (used + p_units > p_limit) return respond(false);
      db.units.set(p_month, used + p_units);
      return respond(true);
    }
    return respond({}, 404);
  }) as typeof fetch;
  const providerCalls = () => calls.filter((c) => c.url.includes('aerodatabox'));
  return { impl, calls, providerCalls, db };
}

function newDb(): Db {
  return { cache: new Map(), units: new Map() };
}

const request = (body: unknown) =>
  new Request('http://localhost/flight-status', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer anon' },
    body: JSON.stringify(body),
  });

const ask = (
  fetchImpl: typeof fetch,
  { at = MORNING, env = envOf(), body = AA2410 as unknown } = {},
) => handle(request(body), { env, fetch: fetchImpl, now: () => at });

describe('AeroDataBox mapping', () => {
  const map = (body: unknown) => mapAeroDataBox((body as AdbFlight[])[0], MORNING);

  it('reads AeroDataBox times as ISO instants', () => {
    expect(adbInstant('2026-11-12 14:05Z')).toBe('2026-11-12T14:05:00.000Z');
    expect(adbInstant('2026-11-12 09:05-05:00')).toBe('2026-11-12T14:05:00.000Z');
    expect(adbInstant(undefined)).toBeNull();
    expect(adbInstant('soon')).toBeNull();
  });

  it('maps an on-time flight: a couple of minutes early counts as 0', () => {
    expect(map(adbOnTime)).toEqual({
      state: 'active',
      delayMinutes: 0,
      departure: { terminal: 'E', gate: 'E75', revisedAt: '2026-11-12T14:03:00.000Z' },
      arrival: { terminal: '1', gate: null, revisedAt: '2026-11-12T18:58:00.000Z' },
      updatedAt: '2026-11-12T12:41:00.000Z',
    });
  });

  it('maps a delayed flight to its departure delay', () => {
    expect(map(adbDelayed)).toMatchObject({ state: 'active', delayMinutes: 25 });
  });

  it('maps a gate change: the new gate replaces the booked one', () => {
    expect(map(adbGateChange)).toMatchObject({
      state: 'active',
      delayMinutes: 0,
      departure: { gate: 'E79', terminal: 'E' },
    });
  });

  it('maps landed and cancelled flights', () => {
    expect(map(adbLanded)).toMatchObject({
      state: 'landed',
      arrival: { gate: 'D7', revisedAt: '2026-11-12T19:14:00.000Z' },
    });
    expect(map(adbCancelled)?.state).toBe('cancelled');
  });

  it('uses the arrival delay once the plane is in the air', () => {
    const [flight] = adbDelayed as AdbFlight[];
    expect(mapAeroDataBox({ ...flight, status: 'EnRoute' }, MORNING)?.delayMinutes).toBe(22);
  });

  it('gives no status when the provider has no live data', () => {
    const [flight] = adbOnTime as AdbFlight[];
    expect(mapAeroDataBox({ ...flight, status: 'Unknown' }, MORNING)).toBeNull();
  });
});

describe('live-status window', () => {
  const departs = new Date(AA2410.departsAt);
  const arrives = new Date(AA2410.arrivesAt);
  const at = (ms: number) => new Date(ms);

  it('opens 24 hours before departure and closes 2 hours after arrival', () => {
    expect(WINDOW_BEFORE_MS).toBe(24 * 3_600_000);
    expect(WINDOW_AFTER_MS).toBe(2 * 3_600_000);
    expect(inStatusWindow(departs, arrives, at(departs.getTime() - WINDOW_BEFORE_MS - 1))).toBe(
      false,
    );
    expect(inStatusWindow(departs, arrives, at(departs.getTime() - WINDOW_BEFORE_MS))).toBe(true);
    expect(inStatusWindow(departs, arrives, MORNING)).toBe(true);
    expect(inStatusWindow(departs, arrives, at(arrives.getTime() + WINDOW_AFTER_MS))).toBe(true);
    expect(inStatusWindow(departs, arrives, at(arrives.getTime() + WINDOW_AFTER_MS + 1))).toBe(
      false,
    );
  });

  it('never calls the provider outside the window', async () => {
    const f = fakeFetch({ body: adbOnTime });
    const res = await ask(f.impl, { at: new Date('2026-11-10T12:00:00Z') });
    expect(res.status).toBe(422);
    expect((await res.json()).error).toBe('outside_window');
    expect(f.calls).toHaveLength(0);
  });
});

describe('flight-status', () => {
  it('answers with the mapped status and asks AeroDataBox with the key in a header', async () => {
    const f = fakeFetch({ body: adbDelayed });
    const res = await ask(f.impl);
    expect(res.status).toBe(200);
    expect((await res.json()).status).toMatchObject({ state: 'active', delayMinutes: 25 });

    const [call] = f.providerCalls();
    expect(call.url).toBe(
      'https://aerodatabox.p.rapidapi.com/flights/number/AA2410/2026-11-12?dateLocalRole=Departure&withAircraftImage=false&withLocation=false',
    );
    expect(call.url).not.toContain('test-key');
    expect((call.init?.headers as Record<string, string>)['X-RapidAPI-Key']).toBe('test-key');
  });

  it('picks the leg leaving the booked airport', async () => {
    const f = fakeFetch({ body: adbTwoLegs });
    const { status } = await (await ask(f.impl)).json();
    expect(status).toMatchObject({ delayMinutes: 25, departure: { gate: 'E75' } });
  });

  it('answers null when the provider has no such flight', async () => {
    const f = fakeFetch({ body: null, status: 204 });
    const res = await ask(f.impl);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: null });
  });

  it('caches answers for 10 minutes per flight', async () => {
    const f = fakeFetch({ body: adbOnTime });
    await ask(f.impl);
    await ask(f.impl, { at: new Date(MORNING.getTime() + 9 * 60_000) });
    expect(f.providerCalls()).toHaveLength(1);
    await ask(f.impl, { at: new Date(MORNING.getTime() + 10 * 60_000) });
    expect(f.providerCalls()).toHaveLength(2);
    expect([...f.db.cache.keys()]).toEqual(['AA2410:2026-11-12:TPA']);
  });

  it('stops calling at 90% of the monthly allowance', async () => {
    // 400 units a month, 2 per call: 360 units = 180 calls, then no more.
    expect(unitLimit(envOf())).toBe(360);
    const db = newDb();
    db.units.set('2026-11', 358);
    const f = fakeFetch({ body: adbOnTime }, db);
    expect((await ask(f.impl)).status).toBe(200);
    expect(db.units.get('2026-11')).toBe(360);

    // The next call, past the cache, would pass the 90% line.
    const later = new Date(MORNING.getTime() + 11 * 60_000);
    const fresh = { ...AA2410, flightNumber: 'AA 2411', from: 'TPA' };
    const res = await ask(f.impl, { at: later, body: fresh });
    expect(res.status).toBe(429);
    expect((await res.json()).error).toBe('limit_reached');
    expect(f.providerCalls()).toHaveLength(1);
    expect(db.units.get('2026-11')).toBe(360);

    // A flight already cached keeps its last answer.
    const stale = await ask(f.impl, { at: later });
    expect(stale.status).toBe(200);
    expect((await stale.json()).status.state).toBe('active');
    expect(f.providerCalls()).toHaveLength(1);
  });

  it('follows a smaller allowance from the secrets', () => {
    expect(unitLimit(envOf({ FLIGHT_STATUS_MONTHLY_UNITS: '100' }))).toBe(90);
    expect(unitLimit(envOf({ FLIGHT_STATUS_MONTHLY_UNITS: 'lots' }))).toBe(360);
  });

  it('says "not configured" without the API key, and calls nothing', async () => {
    const f = fakeFetch({ body: adbOnTime });
    const res = await ask(f.impl, { env: envOf({ FLIGHT_STATUS_API_KEY: undefined }) });
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe('not_configured');
    expect(f.calls).toHaveLength(0);
  });

  it('answers the demo status in fixture mode, without the provider or the counter', async () => {
    const f = fakeFetch({ body: adbOnTime });
    const env = envOf({ FLIGHT_STATUS_PROVIDER: 'fixture', FLIGHT_STATUS_API_KEY: undefined });
    const { status } = await (await ask(f.impl, { env })).json();
    expect(status).toMatchObject({
      delayMinutes: 25,
      departure: { gate: 'E79', revisedAt: '2026-11-12T14:30:00.000Z' },
    });
    expect(f.calls).toHaveLength(0);
  });

  it('turns provider errors into "failed"', async () => {
    const f = fakeFetch({ body: { message: 'nope' }, status: 500 });
    const res = await ask(f.impl);
    expect(res.status).toBe(502);
    expect((await res.json()).error).toBe('failed');
  });

  it('rejects malformed requests and stretched windows', async () => {
    const f = fakeFetch({ body: adbOnTime });
    expect((await ask(f.impl, { body: { flightNumber: 'AA 2410' } })).status).toBe(400);
    const stretched = { ...AA2410, arrivesAt: '2026-11-20T19:02:00.000Z' };
    expect((await ask(f.impl, { body: stretched })).status).toBe(400);
    expect(f.calls).toHaveLength(0);
  });
});
