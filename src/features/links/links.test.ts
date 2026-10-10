import { LINK_SAMPLES } from '../../../supabase/functions/_shared/parse/linkFixtures';
import { newBucketItem } from '@/features/bucket/bucket';
import { curatedReels } from '@/services/cityLinks';
import { createDemoSource, supabaseSource } from '@/services/data';
import { parseLink } from '@/services/parseLink';

import {
  initialTicks,
  linkPlaceFromSpot,
  linkRows,
  placeFromLink,
  platformName,
  savedLinkFrom,
} from './links';
import { DEMO_READ_MS, linkErrorMessage, linkIn, readLink } from './readLink';

jest.mock('@/services/parseLink', () => ({
  ...jest.requireActual('@/services/parseLink'),
  parseLink: jest.fn(async () => ({ places: [] })),
}));

const sample = LINK_SAMPLES['vegas-food'].result;
const AREA = { city: 'Las Vegas', near: { lat: 36.11, lng: -115.17 } };
const EMPTY = {
  trips: [],
  places: [],
  items: [],
  bookings: [],
  bucketItems: [],
  expenses: [],
  documents: [],
  me: 'user-me',
  members: [],
  profiles: [],
};

describe('link rows', () => {
  it('ticks located places and offers Find it for the rest', () => {
    const rows = linkRows(sample);
    expect(rows.map((r) => [r.key, r.title, r.subtitle, r.located])).toEqual([
      ['place-0', "Esther's Kitchen", 'Downtown · Food', true],
      ['place-1', 'Eggslut', 'The Strip · Food', true],
      ['place-2', 'Tacos El Gordo', 'The Strip · Food', true],
      ['place-3', 'Kaiseki Yuzu', 'Not found on the map', false],
    ]);
    expect([...initialTicks(rows)]).toEqual(['place-0', 'place-1', 'place-2']);
    expect(platformName('instagram')).toBe('Instagram');
  });

  it('turns picks into places, a saved link and bucket items that carry it', () => {
    const found = linkPlaceFromSpot({
      id: 'N1',
      name: 'Kaiseki Yuzu',
      kind: null,
      area: null,
      address: null,
      lat: 36.1,
      lng: -115.2,
    });
    expect(placeFromLink(found, sample.url)).toMatchObject({
      name: 'Kaiseki Yuzu',
      sourceUrl: sample.url,
      lat: 36.1,
    });
    const input = savedLinkFrom(sample, 'trip-1', ['p1', 'p2']);
    expect(input).toMatchObject({ tripId: 'trip-1', platform: 'tiktok', placeIds: ['p1', 'p2'] });
    const link = { ...input, id: 'l1' };
    const item = newBucketItem('trip-1', { id: 'p1', kind: 'food' }, 'tiktok', 'k1', link);
    expect(item).toMatchObject({ source: 'tiktok', durationMinutes: 75, link: { id: 'l1' } });
  });
});

describe('readLink', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('answers the sample videos in a demo session without the network', async () => {
    const read = readLink(createDemoSource(EMPTY), `Watch this ${sample.url} !`, AREA);
    jest.advanceTimersByTime(DEMO_READ_MS);
    await expect(read).resolves.toEqual(sample);
    expect(parseLink).not.toHaveBeenCalled();
  });

  it('answers Discover’s handpicked videos from their places, signed in too (TR-34)', async () => {
    const [reel] = curatedReels('Las Vegas');
    const result = await readLink(supabaseSource, reel.url, AREA);
    expect(result.places).toHaveLength(reel.placeCount);
    expect(parseLink).not.toHaveBeenCalled();
  });

  it('sends other links to parse-link, and refuses links that are not videos', async () => {
    await readLink(supabaseSource, 'https://vm.tiktok.com/ZMabc/', AREA);
    expect(parseLink).toHaveBeenCalledWith('https://vm.tiktok.com/ZMabc/', AREA);
    const error = await readLink(supabaseSource, 'https://example.com', AREA).catch((e) => e);
    expect(linkErrorMessage(error)).toBe("That link isn't a TikTok or an Instagram Reel.");
    expect(linkErrorMessage(new Error('x'))).toMatch(/Something went wrong/);
    expect(linkIn('  plain text  ')).toBe('plain text');
  });
});
