import { vegasSnapshot } from '@/scenarios/fixtures/vegas';
import type { ItineraryItem } from '@/services/data/types';

import { itemForPin, itineraryEntries } from './itinerary';

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
