import { SAMPLE_PARSES } from '../_shared/parse/fixtures';
import { readParseResult } from '../_shared/parse/schema';
import gemini429 from './fixtures/gemini-429.json';
import geminiFlight from './fixtures/gemini-flight.json';
import geminiHotel from './fixtures/gemini-hotel.json';
import geminiNotABooking from './fixtures/gemini-not-a-booking.json';
import photonAirport from './fixtures/photon-airport.json';
import photonSilo from './fixtures/photon-silo-hotel.json';
import { handle, mimeTypeFor, type Env } from './index';

// Recorded-format provider responses only (fixtures/): no live model or geocoder calls in CI.

const ENV: Record<string, string> = {
  GEMINI_API_KEY: 'test-key',
  SUPABASE_URL: 'https://project.supabase.co',
  SUPABASE_ANON_KEY: 'anon',
};

const respond = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

interface Call {
  url: string;
  init?: RequestInit;
}

/** A fetch that serves the stored file, the model's answer and Photon's matches. */
function fakeFetch(model: { body: unknown; status?: number }, photon: unknown = { features: [] }) {
  const calls: Call[] = [];
  const impl = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init });
    if (url.includes('/storage/v1/object/')) return new Response(new Uint8Array([37, 80, 68, 70]));
    if (url.includes('generativelanguage')) return respond(model.body, model.status);
    if (url.includes('photon')) return respond(photon);
    return respond({}, 404);
  }) as typeof fetch;
  return { impl, calls };
}

const envOf =
  (overrides: Record<string, string | undefined> = {}): Env =>
  (name) =>
    name in overrides ? overrides[name] : ENV[name];

const request = (body: unknown, auth = 'Bearer user-token') =>
  new Request('http://localhost/parse-booking', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: auth },
    body: JSON.stringify(body),
  });

const PATH = 'user-1/imports/k1-sample-hotel.pdf';

describe('parse-booking', () => {
  it('reads a hotel PDF, validates it and geocodes the hotel', async () => {
    const { impl, calls } = fakeFetch({ body: geminiHotel }, photonSilo);
    const res = await handle(request({ path: PATH }), { env: envOf(), fetch: impl });
    expect(res.status).toBe(200);
    const { result } = await res.json();
    expect(result.booking.type).toBe('hotel');
    expect(result.booking.hotel).toMatchObject({
      name: 'The Silo Hotel',
      lat: -33.9083,
      lng: 18.4217,
    });
    expect(result.booking.price).toEqual({ amount: 63000, currency: 'ZAR' });

    // The file is read with the caller's token, never a service key.
    const download = calls.find((c) => c.url.includes('/storage/'));
    expect(download?.url).toBe(
      'https://project.supabase.co/storage/v1/object/authenticated/originals/user-1/imports/k1-sample-hotel.pdf',
    );
    expect((download?.init?.headers as Record<string, string>).Authorization).toBe(
      'Bearer user-token',
    );
    // The model gets the PDF inline, and the key goes in a header, not the URL.
    const model = calls.find((c) => c.url.includes('generativelanguage'));
    expect(model?.url).not.toContain('test-key');
    const sent = JSON.parse(String(model?.init?.body));
    expect(sent.contents[0].parts[0].inline_data).toEqual({
      mime_type: 'application/pdf',
      data: 'JVBERg==',
    });
  });

  it('reads every leg of a round-trip flight and geocodes the airports', async () => {
    const { impl } = fakeFetch({ body: geminiFlight }, photonAirport);
    const res = await handle(request({ path: 'user-1/imports/flight.png' }), {
      env: envOf(),
      fetch: impl,
    });
    const { result } = await res.json();
    expect(result.booking.legs.map((l: { flightNumber: string }) => l.flightNumber)).toEqual([
      'DL 9201',
      'DL 9202',
    ]);
    expect(result.booking.legs[0].to).toMatchObject({ code: 'CPT', lat: -33.9715 });
    expect(result.uncertain).toEqual(['legs.1.seat']);
  });

  it('says "not configured" without a Gemini key, before touching the file', async () => {
    const { impl, calls } = fakeFetch({ body: geminiHotel });
    const res = await handle(request({ path: PATH }), {
      env: envOf({ GEMINI_API_KEY: undefined }),
      fetch: impl,
    });
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({
      error: 'not_configured',
      message: "Booking import isn't set up yet. Add the booking by hand for now.",
    });
    expect(calls).toEqual([]);
  });

  it('turns a 429 into a friendly retry message', async () => {
    const { impl } = fakeFetch({ body: gemini429, status: 429 });
    const res = await handle(request({ path: PATH }), { env: envOf(), fetch: impl });
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({
      error: 'rate_limited',
      message: 'Too many bookings at once. Try again in a minute.',
    });
  });

  it('rejects an answer that is not a booking', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    const { impl } = fakeFetch({ body: geminiNotABooking });
    const res = await handle(request({ path: PATH }), { env: envOf(), fetch: impl });
    expect(res.status).toBe(422);
    expect((await res.json()).error).toBe('unreadable');
  });

  it('uses the canned sample parses with PARSE_PROVIDER=fixture', async () => {
    const { impl, calls } = fakeFetch({ body: {} });
    const res = await handle(request({ path: 'user-1/imports/restaurant.jpg' }), {
      env: envOf({ PARSE_PROVIDER: 'fixture', GEMINI_API_KEY: undefined }),
      fetch: impl,
    });
    const { result } = await res.json();
    expect(result).toEqual(SAMPLE_PARSES.restaurant);
    expect(calls.some((c) => c.url.includes('generativelanguage'))).toBe(false);
  });

  it('refuses bad paths and unsupported files', async () => {
    const { impl } = fakeFetch({ body: geminiHotel });
    for (const path of ['', '../secrets.pdf', 'user-1/notes.txt']) {
      const res = await handle(request({ path }), { env: envOf(), fetch: impl });
      expect(res.status).toBe(400);
    }
    expect(mimeTypeFor('a/b.JPEG')).toBe('image/jpeg');
  });
});

describe('sample parses', () => {
  it.each(Object.entries(SAMPLE_PARSES))('%s matches the shared schema', (_name, parse) => {
    expect(readParseResult(parse)).toEqual({ ok: true, result: parse });
  });
});
