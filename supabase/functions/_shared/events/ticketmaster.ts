// Ticketmaster Discovery API v2 as a source of trip events (TR-31, ADR 0018): the request we
// send, the fields we read from its answer, and how they become TripEvents. Pure functions, so
// Jest checks them against recorded answers (supabase/functions/events/fixtures/).

import {
  byStart,
  distanceKm,
  inDateRange,
  RADIUS_KM,
  type EventCategory,
  type EventsRequest,
  type TripEvent,
} from './schema.ts';

export const TICKETMASTER_EVENTS = 'https://app.ticketmaster.com/discovery/v2/events.json';
/** The API's largest page; a few pages cover a busy city's long weekend. */
export const PAGE_SIZE = 100;
export const MAX_PAGES = 3;

interface TmName {
  name?: string;
}

export interface TmClassification {
  primary?: boolean;
  segment?: TmName;
  genre?: TmName;
  subGenre?: TmName;
}

export interface TmImage {
  url?: string;
  ratio?: string;
  width?: number;
  fallback?: boolean;
}

export interface TmVenue {
  name?: string;
  address?: { line1?: string };
  city?: { name?: string };
  location?: { latitude?: string; longitude?: string };
}

/** The fields we read from one Discovery API event. */
export interface TmEvent {
  id?: string;
  name?: string;
  url?: string;
  images?: TmImage[];
  dates?: {
    start?: { localDate?: string; localTime?: string; timeTBA?: boolean; noSpecificTime?: boolean };
    status?: { code?: string };
  };
  classifications?: TmClassification[];
  _embedded?: { venues?: TmVenue[] };
}

/** One page of the Discovery API's event search. */
export interface TmPage {
  _embedded?: { events?: TmEvent[] };
  page?: { number?: number; totalPages?: number };
}

const FOOD = /food|drink|culinary|wine|beer|tasting/i;
const NIGHTLIFE_GENRE = /dance|electronic|edm|\bdj\b|club/i;
const NIGHTLIFE_VENUE = /night ?club|day ?club|lounge/i;

/**
 * Ticketmaster's segment and genre as one of Discover's chips: Sports is sports; food and drink
 * genres are food; dance and electronic music, or anything at a nightclub, is nightlife; every
 * other show (concerts, theatre, comedy, film, family) is an event.
 */
export function categoryOf(event: Pick<TmEvent, 'classifications' | '_embedded'>): EventCategory {
  const all = event.classifications ?? [];
  const c = all.find((x) => x.primary) ?? all[0];
  const segment = c?.segment?.name ?? '';
  const genres = [c?.genre?.name, c?.subGenre?.name].filter(Boolean).join(' ');
  const venue = event._embedded?.venues?.[0]?.name ?? '';
  if (/^sports$/i.test(segment)) return 'sports';
  if (FOOD.test(genres)) return 'food';
  if ((/^music$/i.test(segment) && NIGHTLIFE_GENRE.test(genres)) || NIGHTLIFE_VENUE.test(venue)) {
    return 'nightlife';
  }
  return 'events';
}

/** A card-sized picture: the smallest 16:9 image at least 500 px wide, else the widest one. */
export function pickImage(images: TmImage[] | undefined): string | null {
  const usable = (images ?? []).filter((i) => i.url?.startsWith('https://'));
  const wide = usable
    .filter((i) => i.ratio === '16_9' && (i.width ?? 0) >= 500)
    .sort((a, b) => (a.width ?? 0) - (b.width ?? 0));
  const best = wide[0] ?? [...usable].sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0];
  return best?.url ?? null;
}

const number = (value: string | undefined) => {
  const n = Number(value);
  return value !== undefined && value !== '' && Number.isFinite(n) ? n : null;
};

/** One Discovery API event as a TripEvent; null when it has no name or date, or is cancelled. */
export function mapTicketmasterEvent(event: TmEvent): TripEvent | null {
  const start = event.dates?.start;
  const date = start?.localDate;
  if (!event.id || !event.name?.trim() || !date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  if (event.dates?.status?.code === 'cancelled') return null;
  const time =
    start?.localTime && !start.timeTBA && !start.noSpecificTime
      ? start.localTime.slice(0, 5)
      : null;
  const v = event._embedded?.venues?.[0];
  const address = [v?.address?.line1, v?.city?.name].filter(Boolean).join(', ') || null;
  return {
    id: `tm:${event.id}`,
    title: event.name.trim(),
    category: categoryOf(event),
    date,
    time: time && /^\d{2}:\d{2}$/.test(time) ? time : null,
    venue: v?.name
      ? {
          name: v.name,
          address,
          lat: number(v.location?.latitude),
          lng: number(v.location?.longitude),
        }
      : null,
    imageUrl: pickImage(event.images),
    url: event.url?.startsWith('https://') ? event.url : null,
  };
}

/**
 * The trip's events from Discovery API pages: on the trip's local dates (the query asks for a
 * day more each side in UTC), within the radius when the venue has coordinates, without repeats
 * (Ticketmaster lists one show once per ticket type), earliest first.
 */
export function ticketmasterEvents(pages: TmPage[], request: EventsRequest): TripEvent[] {
  const seen = new Set<string>();
  const events: TripEvent[] = [];
  for (const page of pages) {
    for (const raw of page._embedded?.events ?? []) {
      const event = mapTicketmasterEvent(raw);
      if (!event || !inDateRange(event.date, request.startDate, request.endDate)) continue;
      const lat = event.venue?.lat;
      const lng = event.venue?.lng;
      if (lat != null && lng != null && distanceKm(request, { lat, lng }) > RADIUS_KM + 1) continue;
      const key = [event.title.toLowerCase(), event.date, event.time, event.venue?.name].join('|');
      if (seen.has(key)) continue;
      seen.add(key);
      events.push(event);
    }
  }
  return events.sort(byStart);
}

const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';

/** A geohash (Ticketmaster's `geoPoint`); 7 characters is about 150 m. */
export function geohash(lat: number, lng: number, precision = 7): string {
  const latRange = [-90, 90];
  const lngRange = [-180, 180];
  let hash = '';
  let bits = 0;
  let value = 0;
  let even = true;
  while (hash.length < precision) {
    const range = even ? lngRange : latRange;
    const coord = even ? lng : lat;
    const mid = (range[0] + range[1]) / 2;
    value <<= 1;
    if (coord >= mid) {
      value |= 1;
      range[0] = mid;
    } else {
      range[1] = mid;
    }
    even = !even;
    if (++bits === 5) {
      hash += BASE32[value];
      bits = 0;
      value = 0;
    }
  }
  return hash;
}

const shift = (day: string, n: number) =>
  new Date(Date.parse(`${day}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

/** The Discovery API search for one page of the trip's events. */
export function ticketmasterUrl(apiKey: string, request: EventsRequest, page: number): string {
  const params = new URLSearchParams({
    apikey: apiKey,
    geoPoint: geohash(request.lat, request.lng),
    radius: String(RADIUS_KM),
    unit: 'km',
    // A day more each side: local dates span UTC days from −12 to +14 hours.
    startDateTime: `${shift(request.startDate, -1)}T00:00:00Z`,
    endDateTime: `${shift(request.endDate, 1)}T23:59:59Z`,
    size: String(PAGE_SIZE),
    page: String(page),
    sort: 'date,asc',
    locale: '*',
  });
  return `${TICKETMASTER_EVENTS}?${params}`;
}
