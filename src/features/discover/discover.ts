import type { SFSymbol } from 'expo-symbols';

import { DEFAULT_WINDOW, durationForKind } from '@/core/bucket';
import { monthDayLabel, shortRangeLabel, timeLabel } from '@/core/dates';
import { newId } from '@/core/ids';
import { todayIn } from '@/core/trips';
import type { BucketItem, ItineraryItem, Place, PlaceInput, Trip } from '@/services/data/types';
import type { EventCategory, TripEvent } from '@/services/events';

import type { PopularPlace } from './popular';

/** Discover's chips, left to right. */
export const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'events', label: 'Events' },
  { value: 'food', label: 'Food' },
  { value: 'nightlife', label: 'Nightlife' },
  { value: 'sports', label: 'Sports' },
  { value: 'networking', label: 'Networking' },
] as const;

export type DiscoverFilter = (typeof FILTERS)[number]['value'];

/**
 * A trip's section title in "All upcoming trips" (TR-33): "While you're in Las Vegas · Nov 12 – 16"
 * once the trip has started (on its own calendar), "Because you're going to Cape Town ·
 * Dec 18 – Jan 6" before.
 */
export function tripSectionTitle(
  trip: Pick<Trip, 'city' | 'startDate' | 'endDate' | 'timezone'>,
  at: Date,
): string {
  const dates = shortRangeLabel(trip.startDate, trip.endDate);
  return trip.startDate <= todayIn(trip.timezone, at)
    ? `While you're in ${trip.city} · ${dates}`
    : `Because you're going to ${trip.city} · ${dates}`;
}

/** Whether a card's `+` still saves it, or it's already on the Bucket List or the itinerary. */
export type CardState = 'new' | 'saved' | 'planned';

/** One Discover card, ready to draw. */
export interface DiscoverCard {
  id: string;
  title: string;
  /** "Nov 14 · 8:00 PM" for events; the neighbourhood for places. */
  line1: string | null;
  /** The venue for events; "Food" or "Nightlife" for places. */
  line2: string | null;
  imageUrl: string | null;
  /** Drawn on the card when there's no photo. */
  symbol: SFSymbol;
  state: CardState;
  /** A small label on the photo: "Sample" for made-up demo events (TR-34). */
  tag?: string;
}

type TripData = { places: Place[]; items: ItineraryItem[]; bucketItems: BucketItem[] };

const SYMBOLS: Record<EventCategory, SFSymbol> = {
  events: 'ticket',
  food: 'fork.knife',
  nightlife: 'music.note',
  sports: 'sportscourt',
  networking: 'person.2',
};

/** The place kind a saved event's venue gets (its pin symbol). */
const VENUE_KINDS: Record<EventCategory, string> = {
  events: 'event',
  food: 'food',
  nightlife: 'nightlife',
  sports: 'arena',
  networking: 'event',
};

/** Minutes an event usually lasts, for Smart Add's day. */
const EVENT_MINUTES: Record<EventCategory, number> = {
  events: 150,
  food: 120,
  nightlife: 180,
  sports: 180,
  networking: 120,
};

const norm = (s: string | null | undefined) => (s ?? '').trim().toLowerCase();

const matches = (query: string, ...fields: (string | null | undefined)[]) => {
  const q = norm(query);
  return !q || fields.some((f) => norm(f).includes(q));
};

/**
 * Events for the selected chip, matching the search on the title or the venue's name. Made-up
 * samples (TR-34's networking events) show under their own chip only, so All stays real.
 */
export function filterEvents(
  events: readonly TripEvent[],
  filter: DiscoverFilter,
  query: string,
): TripEvent[] {
  return events.filter(
    (e) =>
      (filter === 'all' ? !e.sample : filter === e.category) &&
      matches(query, e.title, e.venue?.name),
  );
}

/** Curated places for the chip (only All, Food and Nightlife show them), matching the search. */
export function filterPopular(
  places: readonly PopularPlace[],
  filter: DiscoverFilter,
  query: string,
): PopularPlace[] {
  return places.filter(
    (p) => (filter === 'all' || filter === p.category) && matches(query, p.name, p.area),
  );
}

const placeName = (data: TripData, placeId: string | null) =>
  placeId ? data.places.find((p) => p.id === placeId)?.name : undefined;

/**
 * Planned when the itinerary has it that day (same title, or the same venue at the same time);
 * saved when the Bucket List has it with the same name and date.
 */
export function eventState(event: TripEvent, data: TripData): CardState {
  const title = norm(event.title);
  const venue = norm(event.venue?.name);
  const planned = data.items.some(
    (i) =>
      i.day === event.date &&
      ((!!i.title &&
        (norm(i.title) === title || (title.length >= 4 && norm(i.title).includes(title)))) ||
        (!!venue && event.time === i.startTime && norm(placeName(data, i.placeId)) === venue)),
  );
  if (planned) return 'planned';
  const saved = data.bucketItems.some(
    (b) => b.fixedDate === event.date && norm(b.title || placeName(data, b.placeId)) === title,
  );
  return saved ? 'saved' : 'new';
}

/** Planned when an itinerary stop is at this place; saved when the Bucket List has it. */
export function placeState(place: PopularPlace, data: TripData): CardState {
  const name = norm(place.name);
  if (data.items.some((i) => norm(placeName(data, i.placeId)) === name)) return 'planned';
  const saved = data.bucketItems.some(
    (b) => !b.fixedDate && norm(placeName(data, b.placeId)) === name,
  );
  return saved ? 'saved' : 'new';
}

export function eventCard(event: TripEvent, data: TripData): DiscoverCard {
  const day = monthDayLabel(event.date);
  return {
    id: event.id,
    title: event.title,
    line1: event.time ? `${day} · ${timeLabel(event.time)}` : day,
    line2: event.venue?.name ?? null,
    imageUrl: event.imageUrl,
    symbol: SYMBOLS[event.category],
    state: eventState(event, data),
    ...(event.sample ? { tag: 'Sample' } : {}),
  };
}

export function placeCard(place: PopularPlace, data: TripData): DiscoverCard {
  return {
    id: place.id,
    title: place.name,
    line1: place.area,
    line2: place.category === 'food' ? 'Food' : 'Nightlife',
    imageUrl: place.photoUrl,
    symbol: SYMBOLS[place.category],
    state: placeState(place, data),
  };
}

/** The trip's existing place with this name (and close by, when both have coordinates). */
export function findPlace(
  places: readonly Place[],
  candidate: Pick<Place, 'name' | 'lat' | 'lng'>,
): Place | undefined {
  const name = norm(candidate.name);
  return places.find(
    (p) =>
      norm(p.name) === name &&
      (p.lat === null ||
        p.lng === null ||
        candidate.lat === null ||
        candidate.lng === null ||
        (Math.abs(p.lat - candidate.lat) < 0.01 && Math.abs(p.lng - candidate.lng) < 0.01)),
  );
}

/** An event's venue as a place to save; the event itself when the provider names no venue. */
export function venuePlace(event: TripEvent): PlaceInput {
  return {
    name: event.venue?.name ?? event.title,
    address: event.venue?.address ?? null,
    lat: event.venue?.lat ?? null,
    lng: event.venue?.lng ?? null,
    kind: VENUE_KINDS[event.category],
    photoUrl: null,
    sourceUrl: event.url,
  };
}

/** A curated place as a place to save. */
export function popularPlace(place: PopularPlace): PlaceInput {
  return {
    name: place.name,
    address: place.address,
    lat: place.lat,
    lng: place.lng,
    kind: place.kind,
    photoUrl: place.photoUrl,
    sourceUrl: null,
  };
}

/** A saved event: its name, at its venue, fixed to its date and time, for Smart Add to keep. */
export function eventBucketItem(
  tripId: string,
  event: TripEvent,
  placeId: string,
  id: string = newId(),
): BucketItem {
  return {
    id,
    tripId,
    placeId,
    durationMinutes: EVENT_MINUTES[event.category],
    windowStart: null,
    windowEnd: null,
    source: 'discover',
    fixedDate: event.date,
    fixedTime: event.time,
    title: event.title,
  };
}

/** A saved curated place: a visit length by kind in the default opening window. */
export function placeBucketItem(
  tripId: string,
  place: Pick<Place, 'id' | 'kind'>,
  id: string = newId(),
): BucketItem {
  return {
    id,
    tripId,
    placeId: place.id,
    durationMinutes: durationForKind(place.kind),
    windowStart: DEFAULT_WINDOW.start,
    windowEnd: DEFAULT_WINDOW.end,
    source: 'discover',
    fixedDate: null,
    fixedTime: null,
  };
}
