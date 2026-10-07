import { pinStyle } from '@/features/map';
import { vegasSnapshot } from '@/scenarios/fixtures/vegas';

import { bucketEntries, bucketPins, newBucketItem, placeFromPin, placeFromSpot } from './bucket';

const data = { places: vegasSnapshot.places, bucketItems: vegasSnapshot.bucketItems };

describe('Bucket List rows and pins', () => {
  it('shows the event title and when it is for a Discover save', () => {
    const fred = bucketEntries(data).find((e) => e.id === 'bucket-fred-again')!;
    expect(fred).toMatchObject({
      title: 'Fred again..',
      subtitle: 'Wynn Las Vegas · Nightlife',
      source: 'From Discover · Sat, Nov 14, 8:00 PM',
      symbol: 'music.note',
    });
  });

  it('falls back when the place is unknown', () => {
    const [entry] = bucketEntries({
      places: [],
      bucketItems: [{ ...data.bucketItems[0], source: null }],
    });
    expect(entry).toMatchObject({ title: 'Saved place', subtitle: null, source: null });
  });

  it('draws each place once as an outlined pin, leaving out places without coordinates', () => {
    const noCoords = { ...data.places[0], id: 'place-nowhere', lat: null, lng: null };
    const pins = bucketPins({
      places: [...data.places, noCoords],
      bucketItems: [
        ...data.bucketItems,
        { ...data.bucketItems[0], id: 'again' },
        { ...data.bucketItems[0], id: 'nowhere', placeId: 'place-nowhere' },
      ],
    });
    expect(pins.map((p) => p.id)).toEqual([
      'place-golden-tiki',
      'place-fremont',
      'place-lotus-of-siam',
      'place-pinball',
      'place-xs',
    ]);
    expect(pins.every((p) => p.outlined && pinStyle(p, true) === 'outline')).toBe(true);
    expect(pins.at(-1)?.label).toBe('Fred again..');
  });
});

describe('adding to the Bucket List', () => {
  it('saves a search result with its kind and address', () => {
    expect(
      placeFromSpot({
        id: 'N42',
        name: 'Eggslut',
        kind: 'food',
        area: 'Paradise',
        address: '3708 S Las Vegas Blvd, Paradise',
        lat: 36.1,
        lng: -115.1,
      }),
    ).toEqual({
      name: 'Eggslut',
      address: '3708 S Las Vegas Blvd, Paradise',
      lat: 36.1,
      lng: -115.1,
      kind: 'food',
      photoUrl: null,
      sourceUrl: null,
    });
  });

  it('saves a dropped pin under the name given', () => {
    expect(placeFromPin('  Viewpoint ', { lat: 36, lng: -115 })).toMatchObject({
      name: 'Viewpoint',
      kind: null,
      lat: 36,
      lng: -115,
    });
  });

  it('gives a new item the default window and a duration by kind', () => {
    expect(newBucketItem('trip-1', { id: 'p1', kind: 'food' }, 'search', 'b1')).toEqual({
      id: 'b1',
      tripId: 'trip-1',
      placeId: 'p1',
      durationMinutes: 75,
      windowStart: '09:00',
      windowEnd: '22:00',
      source: 'search',
      fixedDate: null,
      fixedTime: null,
    });
    expect(newBucketItem('trip-1', { id: 'p1', kind: null }, 'pin').id).toMatch(/^[0-9a-f-]{36}$/);
  });
});
