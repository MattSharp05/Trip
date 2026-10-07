import { FIXTURE_EVENTS } from '../_shared/events/fixtures';
import { NETWORKING_EVENTS, networkingEvents, withNetworking } from '../_shared/events/networking';
import { readEvents, type TripEvent } from '../_shared/events/schema';
import {
  categoryOf,
  geohash,
  mapTicketmasterEvent,
  pickImage,
  ticketmasterEvents,
  ticketmasterUrl,
  type TmEvent,
  type TmPage,
} from '../_shared/events/ticketmaster';
import tmEmpty from './fixtures/tm-empty.json';
import tmPage0 from './fixtures/tm-las-vegas-page-0.json';
import tmPage1 from './fixtures/tm-las-vegas-page-1.json';
import { CACHE_MS, clearCache, handle, type Env } from './index';

// Recorded-format Discovery API answers only (fixtures/): no live Ticketmaster calls in CI.

const VEGAS = { lat: 36.1147, lng: -115.1728, startDate: '2026-11-12', endDate: '2026-11-16' };
const NOON = new Date('2026-10-07T12:00:00Z');

const respond = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const post = (body: unknown) =>
  new Request('https://fn.test/events', { method: 'POST', body: JSON.stringify(body) });

const envOf =
  (vars: Record<string, string>): Env =>
  (name) =>
    vars[name];

/** A fetch that answers Discovery API pages by their `page` parameter. */
function ticketmaster(pages: unknown[], status = 200) {
  return jest.fn(async (url: string | URL | Request) => {
    const page = Number(new URL(String(url)).searchParams.get('page'));
    return respond(pages[page] ?? tmEmpty, status);
  });
}

const titles = (events: TripEvent[]) => events.map((e) => `${e.date} ${e.time} ${e.title}`);

beforeEach(() => clearCache());

describe('categoryOf', () => {
  const tm = (segment: string, genre: string, subGenre = genre, venue = 'Arena'): TmEvent => ({
    classifications: [
      {
        primary: true,
        segment: { name: segment },
        genre: { name: genre },
        subGenre: { name: subGenre },
      },
    ],
    _embedded: { venues: [{ name: venue }] },
  });

  it.each([
    ['Sports', 'Hockey', 'sports'],
    ['Sports', 'Basketball', 'sports'],
    ['Music', 'Dance/Electronic', 'nightlife'],
    ['Music', 'Rock', 'events'],
    ['Arts & Theatre', 'Comedy', 'events'],
    ['Film', 'Drama', 'events'],
    ['Miscellaneous', 'Food & Drink', 'food'],
    ['Miscellaneous', 'Fairs & Festivals', 'events'],
  ])('%s / %s is %s', (segment, genre, category) => {
    expect(categoryOf(tm(segment, genre))).toBe(category);
  });

  it('puts any show at a nightclub under nightlife', () => {
    expect(categoryOf(tm('Music', 'Hip-Hop/Rap', 'Urban', 'XS Nightclub'))).toBe('nightlife');
  });

  it('reads food from the sub-genre too, and falls back to events without a classification', () => {
    expect(categoryOf(tm('Miscellaneous', 'Fairs & Festivals', 'Food & Drink'))).toBe('food');
    expect(categoryOf({})).toBe('events');
  });

  it('uses the primary classification', () => {
    expect(
      categoryOf({
        classifications: [
          { segment: { name: 'Music' }, genre: { name: 'Rock' } },
          { primary: true, segment: { name: 'Sports' }, genre: { name: 'Boxing' } },
        ],
      }),
    ).toBe('sports');
  });
});

describe('mapTicketmasterEvent', () => {
  const [, knights] = tmPage0._embedded.events as TmEvent[];

  it('keeps the venue’s local date and time, the venue and a 16:9 card image', () => {
    expect(mapTicketmasterEvent(knights)).toEqual({
      id: 'tm:vvG1IZ9Kb2',
      title: 'Vegas Golden Knights vs. Colorado Avalanche',
      category: 'sports',
      date: '2026-11-12',
      time: '19:00',
      venue: {
        name: 'T-Mobile Arena',
        address: '3780 Las Vegas Blvd S, Las Vegas',
        lat: 36.10279,
        lng: -115.17845,
      },
      imageUrl: 'https://s1.ticketm.net/dam/a/vvG1IZ/vvG1IZ_RETINA_PORTRAIT_16_9_640.jpg',
      url: 'https://www.ticketmaster.com/event/vvG1IZ9Kb2',
    });
  });

  it('drops cancelled events and events without a name or date; TBA times are null', () => {
    const [, cancelled, tba] = tmPage1._embedded.events as TmEvent[];
    expect(mapTicketmasterEvent(cancelled)).toBeNull();
    expect(mapTicketmasterEvent({ ...knights, name: ' ' })).toBeNull();
    expect(mapTicketmasterEvent({ ...knights, dates: {} })).toBeNull();
    expect(mapTicketmasterEvent(tba)).toMatchObject({ time: null, imageUrl: null });
  });

  it('picks the smallest wide image, else the widest of any shape', () => {
    expect(
      pickImage([
        { url: 'https://i/a.jpg', ratio: '16_9', width: 2048 },
        { url: 'https://i/b.jpg', ratio: '16_9', width: 640 },
        { url: 'https://i/c.jpg', ratio: '16_9', width: 205 },
      ]),
    ).toBe('https://i/b.jpg');
    expect(
      pickImage([
        { url: 'https://i/a.jpg', ratio: '3_2', width: 305 },
        { url: 'https://i/b.jpg', ratio: '4_3', width: 305 },
        { url: 'https://i/c.jpg', ratio: '3_2', width: 1024 },
      ]),
    ).toBe('https://i/c.jpg');
    expect(pickImage([{ url: 'http://i/insecure.jpg', ratio: '16_9', width: 640 }])).toBeNull();
  });
});

describe('ticketmasterEvents (recorded Las Vegas pages)', () => {
  const events = ticketmasterEvents([tmPage0, tmPage1] as TmPage[], VEGAS);

  it('keeps the trip’s local dates only, drops repeats, cancellations and far venues', () => {
    expect(titles(events)).toEqual([
      '2026-11-12 19:00 Vegas Golden Knights vs. Colorado Avalanche',
      '2026-11-13 19:30 Dead & Company',
      '2026-11-14 22:00 Hip-Hop Saturdays',
      '2026-11-14 22:30 Fred again..',
      '2026-11-15 11:00 Las Vegas Food Truck Rally',
      '2026-11-16 null Mystery Comedy Night',
    ]);
  });

  it('maps each to a Discover category', () => {
    expect(events.map((e) => e.category)).toEqual([
      'sports',
      'events',
      'nightlife',
      'nightlife',
      'food',
      'events',
    ]);
  });

  it('includes both ends of the trip', () => {
    const oneDay = ticketmasterEvents([tmPage1] as TmPage[], {
      ...VEGAS,
      startDate: '2026-11-17',
      endDate: '2026-11-17',
    });
    expect(titles(oneDay)).toEqual(['2026-11-17 19:00 Vegas Golden Knights vs. Utah Mammoth']);
  });
});

describe('ticketmasterUrl', () => {
  it('asks around the trip’s centre, a day wider each side in UTC', () => {
    const url = new URL(ticketmasterUrl('key', VEGAS, 1));
    expect(url.origin + url.pathname).toBe('https://app.ticketmaster.com/discovery/v2/events.json');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      apikey: 'key',
      geoPoint: geohash(36.1147, -115.1728),
      radius: '25',
      unit: 'km',
      startDateTime: '2026-11-11T00:00:00Z',
      endDateTime: '2026-11-17T23:59:59Z',
      size: '100',
      page: '1',
      sort: 'date,asc',
      locale: '*',
    });
  });

  it('geohashes like the reference implementation', () => {
    expect(geohash(57.64911, 10.40744, 11)).toBe('u4pruydqqvj');
    expect(geohash(36.1147, -115.1728, 5)).toBe('9qqj7');
  });
});

describe('sample networking events (TR-34)', () => {
  it('has three or four Las Vegas samples on Nov 12–16, tagged as samples', () => {
    expect(NETWORKING_EVENTS.length).toBeGreaterThanOrEqual(3);
    expect(NETWORKING_EVENTS.length).toBeLessThanOrEqual(4);
    expect(readEvents(NETWORKING_EVENTS)).toEqual(NETWORKING_EVENTS);
    for (const e of NETWORKING_EVENTS) {
      expect(e).toMatchObject({ category: 'networking', sample: true });
      expect(e.date >= '2026-11-12' && e.date <= '2026-11-16').toBe(true);
    }
    expect(networkingEvents(VEGAS)).toHaveLength(NETWORKING_EVENTS.length);
  });

  it('shows none in other cities or on other dates', () => {
    const capeTown = { lat: -33.92, lng: 18.42, startDate: '2026-12-18', endDate: '2027-01-06' };
    expect(networkingEvents(capeTown)).toEqual([]);
    expect(networkingEvents({ ...VEGAS, startDate: '2026-12-01', endDate: '2026-12-05' })).toEqual(
      [],
    );
    expect(networkingEvents({ ...VEGAS, startDate: '2026-11-15', endDate: '2026-11-15' })).toEqual(
      [],
    );
  });

  it('merges them into an answer once, earliest first', () => {
    const merged = withNetworking(withNetworking([FIXTURE_EVENTS[0]], VEGAS), VEGAS);
    expect(merged.map((e) => e.id)).toEqual([
      'sample:founders-breakfast-1112',
      'fx:o-bellagio-1112',
      'sample:tech-mixer-1113',
      'sample:women-in-travel-1114',
      'sample:downtown-founders-1116',
    ]);
  });
});

describe('handle', () => {
  const deps = (env: Env, fetchImpl: typeof fetch, now = NOON) => ({
    env,
    fetch: fetchImpl,
    now: () => now,
  });

  it('answers not_configured without a key, and never calls Ticketmaster', async () => {
    const fetchImpl = ticketmaster([tmPage0]);
    const res = await handle(post(VEGAS), deps(envOf({}), fetchImpl as unknown as typeof fetch));
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({
      error: 'not_configured',
      message: 'Event listings are not set up yet.',
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('rejects a bad request', async () => {
    const env = envOf({ TICKETMASTER_API_KEY: 'k' });
    const f = ticketmaster([]) as unknown as typeof fetch;
    for (const body of [
      { ...VEGAS, lat: 120 },
      { ...VEGAS, endDate: '2026-11-11' },
      { ...VEGAS, endDate: '2027-01-30' },
      { lat: 1 },
    ]) {
      expect((await handle(post(body), deps(env, f))).status).toBe(400);
    }
    const get = new Request('https://fn.test/events');
    expect((await handle(get, deps(env, f))).status).toBe(405);
  });

  it('reads every page, then serves the same area and dates from memory for 6 hours', async () => {
    const env = envOf({ TICKETMASTER_API_KEY: 'k' });
    const fetchImpl = ticketmaster([tmPage0, tmPage1]);
    const f = fetchImpl as unknown as typeof fetch;
    const first = await (await handle(post(VEGAS), deps(env, f))).json();
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    // Ticketmaster's six, plus the four sample networking events (TR-34).
    expect(readEvents(first.events)).toHaveLength(10);

    // A few hundred metres away: same area.
    const nearby = { ...VEGAS, lat: 36.1149 };
    const later = new Date(NOON.getTime() + CACHE_MS - 1);
    expect(await (await handle(post(nearby), deps(env, f, later))).json()).toEqual(first);
    expect(fetchImpl).toHaveBeenCalledTimes(2);

    await handle(post(VEGAS), deps(env, f, new Date(NOON.getTime() + CACHE_MS)));
    expect(fetchImpl).toHaveBeenCalledTimes(4);
  });

  it('stops after the last page', async () => {
    const fetchImpl = ticketmaster([tmEmpty]);
    const res = await handle(
      post(VEGAS),
      deps(envOf({ TICKETMASTER_API_KEY: 'k' }), fetchImpl as unknown as typeof fetch),
    );
    // Nothing from Ticketmaster: only the sample networking events (TR-34).
    expect(await res.json()).toEqual({ events: networkingEvents(VEGAS) });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('passes on Ticketmaster’s rate limit and hides other failures', async () => {
    const env = envOf({ TICKETMASTER_API_KEY: 'k' });
    const limited = await handle(
      post(VEGAS),
      deps(env, ticketmaster([], 429) as unknown as typeof fetch),
    );
    expect(limited.status).toBe(429);
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const broken = await handle(
      post(VEGAS),
      deps(env, ticketmaster([], 500) as unknown as typeof fetch),
    );
    expect(broken.status).toBe(502);
    expect(await broken.json()).toEqual({ error: 'failed', message: "Couldn't load events." });
  });

  it('answers the demo events in fixture mode, on the dates and near the trip only', async () => {
    const fetchImpl = jest.fn();
    const res = await handle(
      post(VEGAS),
      deps(envOf({ EVENTS_PROVIDER: 'fixture' }), fetchImpl as unknown as typeof fetch),
    );
    const { events } = (await res.json()) as { events: TripEvent[] };
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(readEvents(events)).toEqual(events);
    expect(events.filter((e) => !e.sample).map((e) => e.id)).toEqual(
      FIXTURE_EVENTS.filter((e) => e.date <= '2026-11-16' && !e.id.includes('msg')).map(
        (e) => e.id,
      ),
    );
    expect(events.filter((e) => e.sample).map((e) => e.id)).toEqual(
      NETWORKING_EVENTS.map((e) => e.id),
    );
    expect(titles(events).slice(0, 3)).toEqual([
      '2026-11-12 08:00 Founders & Funders Breakfast',
      '2026-11-12 19:00 O by Cirque du Soleil',
      '2026-11-13 18:00 Vegas Tech Mixer',
    ]);
  });
});
