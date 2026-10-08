import { vegasSnapshot } from '@/scenarios/fixtures/vegas';
import type { ItineraryItem, Place } from '@/services/data/types';

import { dayPins, pinStyle, pinSymbol } from './pins';

const FRIDAY = '2026-11-13';

describe('dayPins on the Vegas trip', () => {
  const { pins, routeIds, dimmedIds } = dayPins(vegasSnapshot, FRIDAY);
  const pin = (id: string) => pins.find((p) => p.id === id)!;

  it("routes Friday's four stops in visit order", () => {
    expect(routeIds).toEqual([
      'place-mon-ami-gabi',
      'place-bellagio',
      'place-sphere',
      'place-carbone',
    ]);
  });

  it("dims every other day's places, once each", () => {
    expect(dimmedIds.sort()).toEqual(
      [
        'place-area15',
        'place-cosmopolitan',
        'place-forum-shops',
        'place-hertz',
        'place-las',
        'place-peppermill',
        'place-t-mobile',
        'place-venetian',
      ].sort(),
    );
    expect(new Set(pins.map((p) => p.id)).size).toBe(pins.length);
    expect(pins).toHaveLength(12);
  });

  it("numbers Friday's pins by their row in the day's list, with the time; others not", () => {
    expect(
      ['place-mon-ami-gabi', 'place-bellagio', 'place-sphere', 'place-carbone'].map((id) => [
        pin(id).order,
        pin(id).time,
      ]),
    ).toEqual([
      [1, '10:00 AM'],
      [2, '12:00 PM'],
      [3, '3:00 PM'],
      [4, '8:00 PM'],
    ]);
    expect(pin('place-area15').order).toBeUndefined();
    expect(pin('place-area15').time).toBeUndefined();
  });

  it("labels Friday's pins with the plan's title, others with the place name", () => {
    expect(pin('place-carbone').label).toBe('Dinner at Carbone');
    expect(pin('place-cosmopolitan').label).toBe('The Cosmopolitan');
  });

  it('uses the photo when the place has one, else the kind', () => {
    expect(pin('place-bellagio').photo).toMatch(/^https:\/\/commons\.wikimedia\.org/);
    expect(pinStyle(pin('place-bellagio'), false)).toBe('photo');
    expect(pin('place-sphere')).toMatchObject({ photo: null, kind: 'landmark' });
    expect(pinStyle(pin('place-sphere'), false)).toBe('symbol');
  });

  it('leaves out bucket list places', () => {
    expect(pins.find((p) => p.id === 'place-fremont')).toBeUndefined();
  });
});

describe('dayPins edge cases', () => {
  const place = (id: string, extra: Partial<Place> = {}): Place => ({
    id,
    name: id,
    address: null,
    lat: 36,
    lng: -115,
    kind: null,
    photoUrl: null,
    sourceUrl: null,
    ...extra,
  });
  const item = (id: string, day: string, startTime: string | null, placeId: string | null) =>
    ({
      id,
      tripId: 't',
      day,
      startTime,
      durationMinutes: null,
      placeId,
      kind: 'food',
      bookingId: null,
      fixed: false,
      title: `Visit ${id}`,
    }) satisfies ItineraryItem;

  it('sorts by time with untimed items last, and keeps repeat visits on the route', () => {
    const r = dayPins(
      {
        places: [place('a'), place('b')],
        items: [
          item('3', 'd1', null, 'a'),
          item('2', 'd1', '14:00', 'b'),
          item('1', 'd1', '09:00', 'a'),
        ],
      },
      'd1',
    );
    expect(r.routeIds).toEqual(['a', 'b', 'a']);
    expect(r.pins.map((p) => p.id)).toEqual(['a', 'b']);
    expect(r.pins[0].label).toBe('Visit 1');
  });

  it("labels a place by the focus day's visit even when an earlier day visits it too", () => {
    const r = dayPins(
      {
        places: [place('hotel')],
        items: [item('1', 'd1', '15:00', 'hotel'), item('2', 'd2', '10:00', 'hotel')],
      },
      'd2',
    );
    expect(r.pins[0].label).toBe('Visit 2');
    expect(r.dimmedIds).toEqual([]);
  });

  it('counts rows without a map position, so the number matches the list', () => {
    const r = dayPins(
      {
        places: [place('a'), place('b')],
        items: [
          item('1', 'd1', '09:00', null),
          item('2', 'd1', '10:00', 'a'),
          item('3', 'd1', null, 'b'),
          item('4', 'd1', '11:00', 'a'),
        ],
      },
      'd1',
    );
    // A repeat visit keeps the first visit's number and time.
    expect(r.pins.map((p) => [p.id, p.order, p.time])).toEqual([
      ['a', 2, '10:00 AM'],
      ['b', 4, undefined],
    ]);
  });

  it('skips items without a place or coordinates', () => {
    const r = dayPins(
      {
        places: [place('nowhere', { lat: null, lng: null })],
        items: [item('1', 'd1', '09:00', null), item('2', 'd1', '10:00', 'nowhere')],
      },
      'd1',
    );
    expect(r).toEqual({ pins: [], routeIds: [], dimmedIds: [] });
  });

  it("falls back to the item's kind when the place has none", () => {
    const r = dayPins({ places: [place('a')], items: [item('1', 'd1', '09:00', 'a')] }, 'd1');
    expect(r.pins[0].kind).toBe('food');
  });
});

describe('pinStyle', () => {
  const base = { id: 'x', coordinate: { lat: 0, lng: 0 }, kind: 'food', label: 'X' };

  it('draws a dimmed pin as a dot, photo or not', () => {
    expect(pinStyle({ ...base, photo: 'https://example.com/a.jpg' }, true)).toBe('dot');
    expect(pinStyle({ ...base, photo: null }, true)).toBe('dot');
  });
});

describe('pinSymbol', () => {
  it('maps kinds to SF Symbols, with a pin for anything unknown', () => {
    expect(pinSymbol('food')).toBe('fork.knife');
    expect(pinSymbol('hotel')).toBe('bed.double');
    expect(pinSymbol('airport')).toBe('airplane');
    expect(pinSymbol('spaceport')).toBe('mappin');
  });
});
