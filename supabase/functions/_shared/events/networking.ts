// Sample networking events (TR-34). No free source lists networking events yet, so the demo shows
// these made-up Las Vegas ones on the sample trip's dates (Nov 12–16, 2026), tagged "Sample" on
// their cards. The `events` function adds them to every answer (any provider), and scenario demo
// sessions add them in the app, so the Networking chip has something to show in Las Vegas while
// other cities keep "No networking events on your dates yet."
//
// Kept as TypeScript next to the function (not supabase/seed/*.json) because the deploy script
// ships `_shared/**/*.ts` only.

import {
  byStart,
  distanceKm,
  inDateRange,
  RADIUS_KM,
  type EventsRequest,
  type TripEvent,
} from './schema.ts';

export const NETWORKING_EVENTS: readonly TripEvent[] = [
  {
    id: 'sample:founders-breakfast-1112',
    title: 'Founders & Funders Breakfast',
    category: 'networking',
    date: '2026-11-12',
    time: '08:00',
    venue: {
      name: 'The Venetian Expo',
      address: '201 Sands Ave, Las Vegas, NV',
      lat: 36.1218,
      lng: -115.1646,
    },
    imageUrl: null,
    url: null,
    sample: true,
  },
  {
    id: 'sample:tech-mixer-1113',
    title: 'Vegas Tech Mixer',
    category: 'networking',
    date: '2026-11-13',
    time: '18:00',
    venue: {
      name: 'Resorts World Las Vegas',
      address: '3000 Las Vegas Blvd S, Las Vegas, NV',
      lat: 36.1347,
      lng: -115.1654,
    },
    imageUrl: null,
    url: null,
    sample: true,
  },
  {
    id: 'sample:women-in-travel-1114',
    title: 'Women in Travel Meetup',
    category: 'networking',
    date: '2026-11-14',
    time: '17:30',
    venue: {
      name: 'ARIA Resort & Casino',
      address: '3730 Las Vegas Blvd S, Las Vegas, NV',
      lat: 36.1073,
      lng: -115.1766,
    },
    imageUrl: null,
    url: null,
    sample: true,
  },
  {
    id: 'sample:downtown-founders-1116',
    title: 'Downtown Startup Coffee',
    category: 'networking',
    date: '2026-11-16',
    time: '09:30',
    venue: {
      name: 'Downtown Container Park',
      address: '707 Fremont St, Las Vegas, NV',
      lat: 36.1675,
      lng: -115.1384,
    },
    imageUrl: null,
    url: null,
    sample: true,
  },
];

/** The sample networking events on the request's dates within the radius. */
export function networkingEvents(request: EventsRequest): TripEvent[] {
  return NETWORKING_EVENTS.filter(
    (e) =>
      inDateRange(e.date, request.startDate, request.endDate) &&
      e.venue?.lat != null &&
      e.venue.lng != null &&
      distanceKm(request, { lat: e.venue.lat, lng: e.venue.lng }) <= RADIUS_KM,
  );
}

/** A provider's events plus the sample networking ones for the trip, earliest first. */
export function withNetworking(events: readonly TripEvent[], request: EventsRequest): TripEvent[] {
  const ids = new Set(events.map((e) => e.id));
  return [...events, ...networkingEvents(request).filter((e) => !ids.has(e.id))].sort(byStart);
}
