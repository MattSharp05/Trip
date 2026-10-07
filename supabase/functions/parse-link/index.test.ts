import { readFileSync } from 'fs';
import path from 'path';

import { LINK_SAMPLES } from '../_shared/parse/linkFixtures';
import {
  decodeEntities,
  readInstagramMeta,
  readOpenGraph,
  readTikTokOembed,
} from '../_shared/parse/linkMeta';
import { findLink, linkPlatform, readLinkResult } from '../_shared/parse/links';
import { distanceKm, locatePlace, sameName } from '../_shared/parse/locate';
import { BOOKING_PROMPT, linkPrompt } from '../_shared/parse/prompts';
import geminiNoPlaces from './fixtures/gemini-no-places.json';
import geminiPlaces from './fixtures/gemini-places.json';
import photonBestiaFar from './fixtures/photon-bestia-far.json';
import photonEggslutLa from './fixtures/photon-eggslut-la.json';
import photonEggslut from './fixtures/photon-eggslut.json';
import photonEmpty from './fixtures/photon-empty.json';
import photonEstherWrong from './fixtures/photon-esther-wrong-name.json';
import photonLotus from './fixtures/photon-lotus.json';
import photonTacos from './fixtures/photon-tacos.json';
import oembedError from './fixtures/tiktok-oembed-error.json';
import oembed from './fixtures/tiktok-oembed.json';
import { handle, readRequest, type Env } from './index';

// Recorded responses only (fixtures/: TikTok oEmbed and Photon as they answered on 2026-10-07, the
// model's answer in Gemini's format): no live calls in CI.

const html = (name: string) => readFileSync(path.join(__dirname, 'fixtures', name), 'utf8');
const VEGAS = { lat: 36.1699, lng: -115.1398 };
const TIKTOK = 'https://www.tiktok.com/@scout2015/video/6718335390845095173';

const respond = (body: unknown, status = 200) =>
  new Response(typeof body === 'string' ? body : JSON.stringify(body), { status });

interface Routes {
  oembed?: { body: unknown; status?: number };
  instagram?: string;
  model?: { body: unknown; status?: number };
  /** Photon answers by query (`q`); anything else gets no features. */
  photon?: Record<string, unknown>;
}

function fakeFetch(routes: Routes) {
  const calls: string[] = [];
  const impl = (async (input: string | URL | Request) => {
    const url = new URL(String(input));
    calls.push(url.toString());
    if (url.hostname === 'www.tiktok.com' && url.pathname === '/oembed') {
      return respond(routes.oembed?.body ?? oembedError, routes.oembed?.status ?? 200);
    }
    if (url.hostname === 'www.instagram.com') return respond(routes.instagram ?? '', 200);
    if (url.hostname === 'generativelanguage.googleapis.com') {
      return respond(routes.model?.body ?? geminiNoPlaces, routes.model?.status ?? 200);
    }
    if (url.hostname === 'photon.komoot.io') {
      return respond(routes.photon?.[url.searchParams.get('q') ?? ''] ?? photonEmpty);
    }
    return respond({}, 404);
  }) as typeof fetch;
  return { impl, calls };
}

const env =
  (values: Record<string, string>): Env =>
  (name) =>
    values[name];

const post = (body: unknown) =>
  new Request('https://fn.test/parse-link', { method: 'POST', body: JSON.stringify(body) });

async function call(body: unknown, routes: Routes, values = { GEMINI_API_KEY: 'test-key' }) {
  const fake = fakeFetch(routes);
  const res = await handle(post(body), { env: env(values), fetch: fake.impl });
  return { res, json: (await res.json()) as Record<string, unknown>, calls: fake.calls };
}

describe('links', () => {
  it('knows TikTok and Instagram links, short ones included', () => {
    expect(linkPlatform(TIKTOK)).toBe('tiktok');
    expect(linkPlatform('https://vm.tiktok.com/ZMabc123/')).toBe('tiktok');
    expect(linkPlatform('https://www.instagram.com/reel/C0SAMPLE/')).toBe('instagram');
    expect(linkPlatform('https://instagr.am/p/C0SAMPLE/')).toBe('instagram');
    expect(linkPlatform('https://eviltiktok.com/video/1')).toBeNull();
    expect(linkPlatform('https://tiktok.com.example.org/x')).toBeNull();
    expect(linkPlatform('ftp://tiktok.com/x')).toBeNull();
    expect(linkPlatform('not a link')).toBeNull();
  });

  it('finds the link in copied share text', () => {
    expect(findLink('Check this out! https://vm.tiktok.com/ZMabc123/ via TikTok')).toBe(
      'https://vm.tiktok.com/ZMabc123/',
    );
    expect(findLink('(https://www.instagram.com/reel/C0SAMPLE/).')).toBe(
      'https://www.instagram.com/reel/C0SAMPLE/',
    );
    expect(findLink('https://example.com then https://www.tiktok.com/@a/video/1')).toBe(
      'https://www.tiktok.com/@a/video/1',
    );
    expect(findLink('https://example.com/only')).toBeNull();
  });

  it('accepts the sample results as function answers', () => {
    expect(readLinkResult(LINK_SAMPLES['vegas-food'].result)).not.toBeNull();
    expect(readLinkResult({ url: 'x', places: [] })).toBeNull();
  });
});

describe('link metadata', () => {
  it('reads TikTok oEmbed', () => {
    expect(readTikTokOembed(oembed)).toEqual({
      title: oembed.title,
      author: 'Scout, Suki & Stella',
      thumbnailUrl: oembed.thumbnail_url,
    });
    expect(readTikTokOembed(oembedError)).toBeNull();
    expect(
      readTikTokOembed({ ...oembed, thumbnail_url: 'http://insecure/x.jpg' })?.thumbnailUrl,
    ).toBeNull();
  });

  it("reads an Instagram post's Open Graph tags, attribute order and entities included", () => {
    expect(readInstagramMeta(html('instagram-post.html'))).toEqual({
      title:
        'Lotus of Siam has the best khao soi in town. Get the garlic prawns too & thank me later #vegasfood',
      author: 'vegas.eats',
      thumbnailUrl:
        'https://scontent.cdninstagram.com/v/sample-reel.jpg?stp=dst-jpg&_nc_ht=scontent',
    });
    expect(readInstagramMeta(html('instagram-login.html'))).toBeNull();
    expect(readOpenGraph(`<meta content='a &amp; b' property='og:title'>`)).toEqual({
      'og:title': 'a & b',
    });
    expect(decodeEntities('&#x1f35c; &#39;hi&#39; &bogus;')).toBe("🍜 'hi' &bogus;");
  });
});

describe('locating places', () => {
  it('matches names loosely but not other places', () => {
    expect(sameName('Esther’s Kitchen', "Esther's Kitchen")).toBe(true);
    expect(sameName('Eggslut', 'Eggslut Cosmopolitan')).toBe(true);
    expect(sameName("Esther's Kitchen", "Rachel's Kitchen")).toBe(false);
    expect(sameName('Bestia', 'T-Mobile Arena')).toBe(false);
    expect(distanceKm(VEGAS, { lat: 34.0522, lng: -118.2437 })).toBeGreaterThan(300);
  });

  const place = (name: string, city: string | null = 'Las Vegas') => ({ name, city, kind: null });

  it('finds a place inside the trip area first', async () => {
    const { impl, calls } = fakeFetch({ photon: { Eggslut: photonEggslut } });
    const found = await locatePlace(place('Eggslut'), VEGAS, 'Las Vegas', impl);
    expect(found).toMatchObject({ name: 'Eggslut', kind: 'food', lat: 36.109992 });
    expect(calls).toHaveLength(1);
    expect(new URL(calls[0]).searchParams.get('bbox')).toBe('-115.6398,35.6699,-114.6398,36.6699');
  });

  it('falls back to "name, city" but keeps only matches near the trip', async () => {
    const near = fakeFetch({ photon: { 'Lotus of Siam, Las Vegas': photonLotus } });
    expect(await locatePlace(place('Lotus of Siam'), VEGAS, 'Las Vegas', near.impl)).toMatchObject({
      name: 'Lotus of Siam',
      lat: 36.1151943,
    });
    expect(near.calls).toHaveLength(2);

    // A video naming the LA branch: Photon finds it, but 370 km away is not this trip's.
    const far = fakeFetch({ photon: { 'Eggslut, Los Angeles': photonEggslutLa } });
    expect(
      await locatePlace(place('Eggslut', 'Los Angeles'), VEGAS, 'Las Vegas', far.impl),
    ).toMatchObject({ lat: null, lng: null, area: 'Los Angeles' });
  });

  it('never takes a different place with a similar name', async () => {
    const { impl } = fakeFetch({
      photon: {
        "Esther's Kitchen, Las Vegas": photonEstherWrong,
        'Bestia, Las Vegas': photonBestiaFar,
      },
    });
    expect(await locatePlace(place("Esther's Kitchen"), VEGAS, null, impl)).toMatchObject({
      name: "Esther's Kitchen",
      lat: null,
    });
    expect(await locatePlace(place('Bestia'), VEGAS, null, impl)).toMatchObject({ lat: null });
  });

  it('uses the trip city when the video gives none, and survives Photon failing', async () => {
    const { impl, calls } = fakeFetch({ photon: { 'Lotus of Siam, Las Vegas': photonLotus } });
    expect(await locatePlace(place('Lotus of Siam', null), null, 'Las Vegas', impl)).toMatchObject({
      lat: 36.1151943,
    });
    expect(calls).toHaveLength(1);
    const broken = (async () => {
      throw new Error('offline');
    }) as unknown as typeof fetch;
    expect(await locatePlace(place('Eggslut'), VEGAS, 'Las Vegas', broken)).toMatchObject({
      lat: null,
    });
  });
});

describe('prompts', () => {
  it('fills the caption and city in literally', () => {
    const prompt = linkPrompt('Tacos for $5 at $& {city}', 'Las Vegas');
    expect(prompt).toContain("The traveller's trip is in: Las Vegas");
    expect(prompt).toContain('Tacos for $5 at $& {city}');
    expect(BOOKING_PROMPT).toContain('"type":"flight"');
  });
});

describe('parse-link handle', () => {
  const tacos = { 'Tacos El Gordo': photonTacos, Eggslut: photonEggslut };

  it('reads a TikTok: oEmbed caption → model → places near the trip', async () => {
    const { res, json, calls } = await call(
      { url: TIKTOK, near: VEGAS, city: 'Las Vegas' },
      {
        oembed: { body: oembed },
        model: { body: geminiPlaces },
        photon: { ...tacos, 'Lotus of Siam, Las Vegas': photonLotus },
      },
    );
    expect(res.status).toBe(200);
    const result = readLinkResult(json.result)!;
    expect(result).toMatchObject({
      url: TIKTOK,
      platform: 'tiktok',
      title: oembed.title,
      author: 'Scout, Suki & Stella',
    });
    // Duplicate "eggslut" dropped; Tacos El Gordo's unknown kind ("cafe") replaced by OSM's;
    // Bestia not found near Las Vegas (Photon's "T-Mobile Arena" is not it).
    expect(result.places.map((p) => [p.name, p.kind, p.lat !== null])).toEqual([
      ['Eggslut', 'food', true],
      ['Tacos El Gordo', 'food', true],
      ['Lotus of Siam', 'food', true],
      ['Bestia', 'food', false],
    ]);
    const model = calls.find((c) => c.includes('generativelanguage'));
    expect(model).toContain('gemini-flash-latest:generateContent');
  });

  it('asks the model with the caption and the trip city', async () => {
    const seen: string[] = [];
    const fake = fakeFetch({ oembed: { body: oembed } });
    const spy = (async (input: string | URL | Request, init?: RequestInit) => {
      if (String(input).includes('generativelanguage')) seen.push(String(init?.body));
      return fake.impl(input, init);
    }) as typeof fetch;
    await handle(post({ url: TIKTOK, city: 'Las Vegas' }), {
      env: env({ GEMINI_API_KEY: 'k' }),
      fetch: spy,
    });
    const body = JSON.parse(seen[0]) as { contents: { parts: { text: string }[] }[] };
    expect(body.contents[0].parts[0].text).toContain('Scramble up ur name');
    expect(body.contents[0].parts[0].text).toContain('trip is in: Las Vegas');
  });

  it('returns no places, without asking the model, when the video has no caption', async () => {
    const { res, json, calls } = await call(
      { url: 'https://www.instagram.com/reel/C0SAMPLE/' },
      { instagram: html('instagram-login.html') },
    );
    expect(res.status).toBe(200);
    expect(json.result).toMatchObject({ platform: 'instagram', title: null, places: [] });
    expect(calls.some((c) => c.includes('generativelanguage'))).toBe(false);
  });

  it('reads an Instagram post when Instagram shares its text', async () => {
    const { json } = await call(
      { url: 'https://www.instagram.com/reel/C0SAMPLE/', near: VEGAS },
      { instagram: html('instagram-post.html'), model: { body: geminiNoPlaces } },
    );
    expect(json.result).toMatchObject({ author: 'vegas.eats', places: [] });
  });

  it('says "not set up yet" without a key, and answers the samples in fixture mode', async () => {
    const off = await call({ url: TIKTOK }, {}, {} as { GEMINI_API_KEY: string });
    expect(off.res.status).toBe(503);
    expect(off.json).toMatchObject({ error: 'not_configured' });
    expect(off.calls).toEqual([]);

    const sample = LINK_SAMPLES['vegas-food'].result;
    const fixture = await call({ url: sample.url, near: VEGAS }, {}, {
      PARSE_PROVIDER: 'fixture',
    } as unknown as { GEMINI_API_KEY: string });
    expect(fixture.json.result).toEqual(sample);
    expect(fixture.calls).toEqual([]);
  });

  it('turns model failures into the app’s error codes', async () => {
    const limited = await call(
      { url: TIKTOK },
      { oembed: { body: oembed }, model: { body: {}, status: 429 } },
    );
    expect(limited.res.status).toBe(429);
    expect(limited.json).toMatchObject({ error: 'rate_limited' });

    const garbage = await call(
      { url: TIKTOK },
      {
        oembed: { body: oembed },
        model: { body: { candidates: [{ content: { parts: [{ text: '{"places":"no"}' }] } }] } },
      },
    );
    expect(garbage.res.status).toBe(200);
    expect(garbage.json.result).toMatchObject({ places: [] });
  });

  it('rejects other links and bad requests', async () => {
    expect((await call({ url: 'https://example.com/video' }, {})).json).toMatchObject({
      error: 'unsupported',
    });
    expect((await call({ url: '' }, {})).res.status).toBe(400);
    expect((await call({ url: TIKTOK, near: { lat: 100, lng: 0 } }, {})).res.status).toBe(400);
    const get = await handle(new Request('https://fn.test/parse-link'), {
      env: env({}),
      fetch: fakeFetch({}).impl,
    });
    expect(get.status).toBe(405);
    expect(readRequest({ url: TIKTOK, city: '  ' })).toEqual({
      url: TIKTOK,
      near: null,
      city: null,
    });
  });
});
