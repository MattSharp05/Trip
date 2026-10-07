import { planBucketSmartAdd } from '@/features/bucket';
import { vegasSnapshot } from '@/scenarios/fixtures/vegas';
import type { Place, TripData } from '@/services/data/types';
import type { TripEvent } from '@/services/events';

import { FIXTURE_EVENTS, fixtureEvents } from '../../../supabase/functions/_shared/events/fixtures';
import {
  eventBucketItem,
  eventCard,
  eventState,
  filterEvents,
  filterPopular,
  findPlace,
  placeBucketItem,
  placeCard,
  tripSectionTitle,
  venuePlace,
} from './discover';
import { popularPlaces } from './popular';

const VEGAS = { lat: 36.1147, lng: -115.1728, startDate: '2026-11-12', endDate: '2026-11-16' };
const events = fixtureEvents(VEGAS);
const data = {
  places: vegasSnapshot.places,
  items: vegasSnapshot.items.filter((i) => i.tripId === 'trip-vegas'),
  bucketItems: vegasSnapshot.bucketItems,
};
const byId = (id: string) => FIXTURE_EVENTS.find((e) => e.id === id) as TripEvent;
const titles = (list: { title: string }[]) => list.map((e) => e.title);

describe('filterEvents', () => {
  it('keeps everything for All, one category per chip, and nothing for Networking', () => {
    expect(filterEvents(events, 'all', '')).toHaveLength(events.length);
    expect(titles(filterEvents(events, 'sports', ''))).toEqual([
      'Vegas Golden Knights vs. Seattle Kraken',
      'UFC 310',
    ]);
    expect(titles(filterEvents(events, 'nightlife', ''))).toEqual([
      'Late night at Zouk Nightclub',
      'Fred again..',
    ]);
    expect(titles(filterEvents(events, 'food', ''))).toEqual([
      'Downtown Las Vegas Food Tour',
      'Wine and Small Plates Walk',
    ]);
    expect(titles(filterEvents(events, 'events', ''))).toEqual([
      'O by Cirque du Soleil',
      'Comedy Cellar Late Show',
    ]);
    expect(filterEvents(events, 'networking', '')).toEqual([]);
  });

  it('searches titles and venue names, ignoring case and spaces', () => {
    expect(titles(filterEvents(events, 'all', '  t-mobile '))).toEqual([
      'Vegas Golden Knights vs. Seattle Kraken',
      'UFC 310',
    ]);
    expect(titles(filterEvents(events, 'all', 'FRED'))).toEqual(['Fred again..']);
    expect(filterEvents(events, 'food', 'fred')).toEqual([]);
  });
});

describe('filterPopular', () => {
  const vegas = popularPlaces('Las Vegas');

  it('has a curated list for each sample city, and none elsewhere', () => {
    expect(vegas.length).toBeGreaterThan(3);
    for (const city of ['New York', 'Cape Town', ' tokyo ']) {
      expect(popularPlaces(city).length).toBeGreaterThan(0);
    }
    expect(popularPlaces('Lisbon')).toEqual([]);
  });

  it('filters by Food or Nightlife and by name or area', () => {
    expect(filterPopular(vegas, 'nightlife', '').every((p) => p.category === 'nightlife')).toBe(
      true,
    );
    expect(filterPopular(vegas, 'all', 'caesars').map((p) => p.name)).toEqual([
      "Hell's Kitchen",
      'Omnia Nightclub',
    ]);
  });
});

describe('card states on the sample trip', () => {
  it('marks Fred again.. saved (Bucket List, same name and date) and UFC 310 planned', () => {
    expect(eventState(byId('fx:fred-again-xs-1114'), data)).toBe('saved');
    expect(eventState(byId('fx:ufc-310-1115'), data)).toBe('planned');
    expect(eventState(byId('fx:golden-knights-1113'), data)).toBe('new');
  });

  it('marks an event planned when its venue is on the itinerary at the same time', () => {
    const sphere: TripEvent = {
      ...byId('fx:o-bellagio-1112'),
      id: 'fx:sphere',
      title: 'Postcard from Earth',
      date: '2026-11-13',
      time: '15:00',
      venue: { name: 'Sphere', address: null, lat: null, lng: null },
    };
    expect(eventState(sphere, data)).toBe('planned');
    expect(eventState({ ...sphere, time: '19:00' }, data)).toBe('new');
  });

  it('a saved event on another date is not this one', () => {
    expect(eventState({ ...byId('fx:fred-again-xs-1114'), date: '2026-11-15' }, data)).toBe('new');
  });

  it('draws popular places as saved, planned or new', () => {
    const states = Object.fromEntries(
      popularPlaces('Las Vegas').map((p) => [p.name, placeCard(p, data).state]),
    );
    expect(states).toEqual({
      "Hell's Kitchen": 'new',
      'Omnia Nightclub': 'new',
      'Lotus of Siam': 'saved',
      'Golden Tiki': 'saved',
      'Peppermill Restaurant': 'planned',
      'Mon Ami Gabi': 'planned',
    });
  });

  it('writes the date and local time on event cards', () => {
    expect(eventCard(byId('fx:fred-again-xs-1114'), data)).toMatchObject({
      title: 'Fred again..',
      line1: 'Nov 14 · 8:00 PM',
      line2: 'XS Nightclub',
      symbol: 'music.note',
    });
    expect(eventCard({ ...byId('fx:ufc-310-1115'), time: null }, data).line1).toBe('Nov 15');
  });
});

describe('saving', () => {
  it('saves an event as a bucket item fixed to its date and time, at its venue', () => {
    const fred = byId('fx:fred-again-xs-1114');
    expect(eventBucketItem('trip-vegas', fred, 'place-xs', 'b1')).toEqual({
      id: 'b1',
      tripId: 'trip-vegas',
      placeId: 'place-xs',
      durationMinutes: 180,
      windowStart: null,
      windowEnd: null,
      source: 'discover',
      fixedDate: '2026-11-14',
      fixedTime: '20:00',
      title: 'Fred again..',
    });
    expect(venuePlace(fred)).toMatchObject({
      name: 'XS Nightclub',
      kind: 'nightlife',
      lat: 36.1272,
    });
  });

  it('names the place after the event when there is no venue', () => {
    expect(venuePlace({ ...byId('fx:ufc-310-1115'), venue: null })).toMatchObject({
      name: 'UFC 310',
      lat: null,
      kind: 'arena',
    });
  });

  it('reuses a venue the trip already has, by name and position', () => {
    expect(findPlace(data.places, venuePlace(byId('fx:ufc-310-1115')))?.id).toBe('place-t-mobile');
    expect(findPlace(data.places, { name: 'T-Mobile Arena', lat: 40.7, lng: -74 })).toBeUndefined();
    expect(
      findPlace(data.places, { name: 'Zouk Nightclub', lat: null, lng: null }),
    ).toBeUndefined();
  });

  it('saves a curated place with the default opening window', () => {
    expect(placeBucketItem('trip-vegas', { id: 'p1', kind: 'food' }, 'b2')).toMatchObject({
      source: 'discover',
      durationMinutes: 75,
      windowStart: '09:00',
      windowEnd: '22:00',
      fixedDate: null,
    });
  });
});

describe('Smart Add places a saved event (TR-29)', () => {
  const trip = vegasSnapshot.trips.find((t) => t.id === 'trip-vegas')!;
  const tripData: TripData = { trip, ...data, bookings: [], expenses: [] };

  it('on its own date and time, as a fixed event with its name', () => {
    const zouk = byId('fx:zouk-1113');
    const venue = { ...venuePlace(zouk), id: 'place-zouk' } as Place;
    const item = eventBucketItem(trip.id, zouk, venue.id);
    const plan = planBucketSmartAdd(
      { ...tripData, places: [...data.places, venue], bucketItems: [...data.bucketItems, item] },
      item,
    );
    if (!('change' in plan)) throw new Error(plan.message);
    expect(plan.change.save[0]).toMatchObject({
      day: '2026-11-13',
      startTime: '22:30',
      placeId: 'place-zouk',
      kind: 'event',
      fixed: true,
      title: 'Late night at Zouk Nightclub',
    });
    expect(plan.change.removeBucket).toEqual([item.id]);
  });

  it('says so when it overlaps a fixed stop (the Golden Knights game runs into dinner at Carbone)', () => {
    const knights = byId('fx:golden-knights-1113');
    const item = eventBucketItem(trip.id, knights, 'place-t-mobile');
    expect(planBucketSmartAdd(tripData, item)).toEqual({
      message: 'Overlaps Dinner at Carbone at 8:00 PM.',
    });
  });
});

describe('tripSectionTitle', () => {
  const vegas = {
    city: 'Las Vegas',
    startDate: '2026-11-12',
    endDate: '2026-11-16',
    timezone: 'America/Los_Angeles',
  };
  const capeTown = {
    city: 'Cape Town',
    startDate: '2026-12-18',
    endDate: '2027-01-06',
    timezone: 'Africa/Johannesburg',
  };

  it('says "Because you\'re going to" before the trip and "While you\'re in" during it', () => {
    const friday = new Date('2026-11-13T09:00:00-08:00');
    expect(tripSectionTitle(vegas, friday)).toBe("While you're in Las Vegas · Nov 12 – 16");
    expect(tripSectionTitle(capeTown, friday)).toBe(
      "Because you're going to Cape Town · Dec 18 – Jan 6",
    );
  });

  it('starts on the trip’s own calendar', () => {
    // 11 PM in Tampa on Nov 11 is still Nov 11 in Las Vegas, and Nov 12 already in Cape Town.
    const lateNov11 = new Date('2026-11-11T23:00:00-05:00');
    expect(tripSectionTitle(vegas, lateNov11)).toMatch(/^Because/);
    expect(tripSectionTitle({ ...capeTown, startDate: '2026-11-12' }, lateNov11)).toMatch(/^While/);
  });
});

describe('Cape Town fixture events', () => {
  it('are on the Cape Town trip’s dates and nowhere near Las Vegas', () => {
    const capeTown = {
      lat: -33.9249,
      lng: 18.4241,
      startDate: '2026-12-18',
      endDate: '2027-01-06',
    };
    expect(titles(fixtureEvents(capeTown))).toEqual([
      'Neighbourgoods Market',
      'Kirstenbosch Summer Sunset Concert',
      "New Year's Eve at the V&A Waterfront",
      'Proteas New Year Test, Day 1',
    ]);
    expect(titles(events).some((t) => t.includes('Kirstenbosch'))).toBe(false);
  });
});
