import { vegasSnapshot } from '@/scenarios/fixtures/vegas';
import type { ItineraryItem } from '@/services/data/types';

import { findScenario } from '@/scenarios/registry';

import { itemForPin, itineraryEntries, legCaption, type ItineraryLeg } from './itinerary';

describe('itineraryEntries', () => {
  it("draws Friday's stops in time order with times, places and thumbnails", () => {
    const entries = itineraryEntries(vegasSnapshot, '2026-11-13');
    expect(entries.map((e) => [e.time, e.title, e.subtitle])).toEqual([
      ['10:00 AM', 'Brunch at Mon Ami Gabi', 'Paris Las Vegas'],
      ['12:00 PM', 'Bellagio Fountains', '3600 Las Vegas Blvd S'],
      ['3:00 PM', 'Sphere Experience', '255 Sands Ave'],
      ['8:00 PM', 'Dinner at Carbone', 'ARIA Resort & Casino'],
    ]);
    const sphere = entries[2];
    expect(sphere).toMatchObject({
      placeId: 'place-sphere',
      photo: null,
      symbol: 'building.columns',
    });
    expect(entries[1].photo).toMatch(/^https:/);
  });

  it('gives a flight its number and a free day no entries', () => {
    expect(itineraryEntries(vegasSnapshot, '2026-11-12')[0].subtitle).toBe('AA 2410');
    expect(itineraryEntries(vegasSnapshot, '2026-11-20')).toEqual([]);
  });

  it('falls back to the place name, puts untimed items last and survives a missing place', () => {
    const extra: ItineraryItem[] = [
      { ...vegasSnapshot.items[4], id: 'x-untimed', startTime: null, title: undefined },
      { ...vegasSnapshot.items[4], id: 'x-noplace', startTime: '08:00', placeId: null },
    ];
    const entries = itineraryEntries(
      { ...vegasSnapshot, items: [...vegasSnapshot.items, ...extra] },
      '2026-11-13',
    );
    expect(entries[0]).toMatchObject({
      id: 'x-noplace',
      placeId: null,
      subtitle: null,
      symbol: 'fork.knife',
    });
    expect(entries.at(-1)).toMatchObject({ id: 'x-untimed', time: null, title: 'Mon Ami Gabi' });
  });
});

describe('travel legs', () => {
  const legs = (data = vegasSnapshot, day = '2026-11-13') =>
    itineraryEntries(data, day).map((e) =>
      e.leg ? [e.leg.estimate.mode, e.leg.estimate.minutes, e.leg.gap, e.leg.tight] : null,
    );

  it("puts a leg between each of Friday's stops; brunch to the fountains is a short walk", () => {
    expect(legs()).toEqual([
      ['walk', 3, 45, false],
      ['drive', 9, 120, false],
      ['drive', 10, 210, false],
      null,
    ]);
  });

  it('flags a leg longer than the gap (vegas-plan-tight)', () => {
    const tight = findScenario('vegas-plan-tight')!.data;
    expect(legs(tight)[1]).toEqual(['drive', 9, 5, true]);
    expect(legs(tight)[2]).toEqual(['drive', 10, 325, false]);
  });

  it('skips legs without a map position or between visits to the same place', () => {
    const [brunch, fountains] = vegasSnapshot.items.filter((i) => i.day === '2026-11-13');
    const data = {
      ...vegasSnapshot,
      items: [
        { ...brunch, id: 'a', startTime: '08:00', placeId: null },
        { ...brunch, id: 'b', startTime: '09:00' },
        { ...brunch, id: 'c', startTime: '10:00' },
        { ...fountains, id: 'd', startTime: null },
      ],
    };
    const entries = itineraryEntries(data, brunch.day);
    expect(entries.map((e) => e.id)).toEqual(['a', 'b', 'c', 'd']);
    expect(entries[0].leg).toBeNull();
    expect(entries[1].leg).toBeNull();
    // An untimed stop still gets a leg, with no gap to compare against.
    expect(entries[2].leg).toMatchObject({ gap: null, tight: false });
  });
});

describe('legCaption', () => {
  const leg = (over: Partial<ItineraryLeg>): ItineraryLeg => ({
    estimate: { mode: 'drive', minutes: 25, distanceKm: 9.7 },
    gap: 40,
    tight: false,
    ...over,
  });

  it('gives time, mode and distance in the preferred unit', () => {
    expect(legCaption(leg({}), 'miles')).toBe('25 min drive · 6 mi');
    expect(legCaption(leg({ estimate: { mode: 'walk', minutes: 6, distanceKm: 0.5 } }), 'km')).toBe(
      '6 min walk · 0.5 km',
    );
  });

  it('warns when the leg is longer than the gap', () => {
    expect(legCaption(leg({ gap: 15, tight: true }), 'km')).toBe('Tight: 25 min drive, 15 min gap');
    expect(legCaption(leg({ gap: -10, tight: true }), 'km')).toBe('Tight: 25 min drive, no gap');
  });
});

describe('itemForPin', () => {
  const { items } = vegasSnapshot;

  it("picks the day's visit to the place, else its first visit on another day", () => {
    expect(itemForPin(items, 'place-carbone', '2026-11-13')).toEqual({
      itemId: 'item-08',
      day: '2026-11-13',
    });
    // The hotel is visited on the first and last day.
    expect(itemForPin(items, 'place-cosmopolitan', '2026-11-16')).toEqual({
      itemId: 'item-13',
      day: '2026-11-16',
    });
    expect(itemForPin(items, 'place-cosmopolitan', '2026-11-13')).toEqual({
      itemId: 'item-03',
      day: '2026-11-12',
    });
    expect(itemForPin(items, 'place-nowhere', '2026-11-13')).toBeNull();
  });
});
