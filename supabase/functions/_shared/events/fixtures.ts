// Deterministic demo events (TR-31): Las Vegas, around the sample trip's dates (Nov 12–16, 2026).
// The `events` function answers with these when EVENTS_PROVIDER=fixture, and scenario demo
// sessions use them in the app without calling the function (like the flight-status fixtures).

import {
  byStart,
  distanceKm,
  inDateRange,
  RADIUS_KM,
  type EventsRequest,
  type TripEvent,
} from './schema.ts';

/** Wikimedia Commons image at a phone-friendly width. */
const commons = (file: string) =>
  `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=640`;

const T_MOBILE = {
  name: 'T-Mobile Arena',
  address: '3780 Las Vegas Blvd S, Las Vegas, NV',
  lat: 36.1029,
  lng: -115.1784,
};

/**
 * Every demo event. Two sit outside the sample trip on purpose (a day after it, and in New York),
 * so tests see the date and distance filters at work.
 */
export const FIXTURE_EVENTS: readonly TripEvent[] = [
  {
    id: 'fx:o-bellagio-1112',
    title: 'O by Cirque du Soleil',
    category: 'events',
    date: '2026-11-12',
    time: '19:00',
    venue: {
      name: 'O Theatre at Bellagio',
      address: '3600 Las Vegas Blvd S, Las Vegas, NV',
      lat: 36.1126,
      lng: -115.1767,
    },
    imageUrl: commons('Bellagio Fountains (1150330184).jpg'),
    url: null,
  },
  {
    id: 'fx:golden-knights-1113',
    title: 'Vegas Golden Knights vs. Seattle Kraken',
    category: 'sports',
    date: '2026-11-13',
    time: '19:00',
    venue: T_MOBILE,
    imageUrl: commons('T-Mobile Arena Outside.jpg'),
    url: null,
  },
  {
    id: 'fx:zouk-1113',
    title: 'Late night at Zouk Nightclub',
    category: 'nightlife',
    date: '2026-11-13',
    time: '22:30',
    venue: {
      name: 'Zouk Nightclub',
      address: 'Resorts World, 3000 Las Vegas Blvd S, Las Vegas, NV',
      lat: 36.1347,
      lng: -115.1654,
    },
    imageUrl: null,
    url: null,
  },
  {
    id: 'fx:food-tour-1114',
    title: 'Downtown Las Vegas Food Tour',
    category: 'food',
    date: '2026-11-14',
    time: '12:00',
    venue: {
      name: 'Fremont Street Experience',
      address: 'Fremont St, Las Vegas, NV',
      lat: 36.1707,
      lng: -115.144,
    },
    imageUrl: commons('Fremont Street Experience.jpg'),
    url: null,
  },
  {
    id: 'fx:fred-again-xs-1114',
    title: 'Fred again..',
    category: 'nightlife',
    date: '2026-11-14',
    time: '20:00',
    venue: {
      name: 'XS Nightclub',
      address: 'Wynn Las Vegas, 3131 Las Vegas Blvd S',
      lat: 36.1272,
      lng: -115.1653,
    },
    imageUrl: commons('Wynn Las Vegas.jpg'),
    url: null,
  },
  {
    id: 'fx:wine-walk-1115',
    title: 'Wine and Small Plates Walk',
    category: 'food',
    date: '2026-11-15',
    time: '16:00',
    venue: {
      name: 'The Forum Shops',
      address: 'Caesars Palace, 3500 Las Vegas Blvd S',
      lat: 36.1178,
      lng: -115.1764,
    },
    imageUrl: null,
    url: null,
  },
  {
    id: 'fx:ufc-310-1115',
    title: 'UFC 310',
    category: 'sports',
    date: '2026-11-15',
    time: '18:00',
    venue: T_MOBILE,
    imageUrl: commons('T-Mobile Arena (31534778122).jpg'),
    url: null,
  },
  {
    id: 'fx:comedy-1116',
    title: 'Comedy Cellar Late Show',
    category: 'events',
    date: '2026-11-16',
    time: '21:30',
    venue: {
      name: 'Rio Hotel & Casino',
      address: '3700 W Flamingo Rd, Las Vegas, NV',
      lat: 36.1167,
      lng: -115.1879,
    },
    imageUrl: null,
    url: null,
  },
  {
    id: 'fx:golden-knights-1117',
    title: 'Vegas Golden Knights vs. Utah Mammoth',
    category: 'sports',
    date: '2026-11-17',
    time: '19:00',
    venue: T_MOBILE,
    imageUrl: commons('T-Mobile Arena Outside.jpg'),
    url: null,
  },
  {
    id: 'fx:knicks-msg-1114',
    title: 'New York Knicks vs. Boston Celtics',
    category: 'sports',
    date: '2026-11-14',
    time: '19:30',
    venue: {
      name: 'Madison Square Garden',
      address: '4 Pennsylvania Plaza, New York, NY',
      lat: 40.7505,
      lng: -73.9934,
    },
    imageUrl: null,
    url: null,
  },
];

/** The demo events on the request's dates within the radius, earliest first. */
export function fixtureEvents(request: EventsRequest): TripEvent[] {
  return FIXTURE_EVENTS.filter(
    (e) =>
      inDateRange(e.date, request.startDate, request.endDate) &&
      (!e.venue || e.venue.lat === null || e.venue.lng === null
        ? true
        : distanceKm(request, { lat: e.venue.lat, lng: e.venue.lng }) <= RADIUS_KM),
  ).sort(byStart);
}
