/**
 * Booking import (TR-25): what a parsed booking becomes once the traveller saves it. Pure; the
 * import feature runs the writes. One parsed booking gives wallet bookings (one per flight leg),
 * the places they point at (pins on the map), fixed itinerary items (check-in, pick-up, arrival)
 * and an expense when it has a price. Restaurant reservations are saved as ticket bookings, which
 * the wallet already labels "Event tickets and reservations".
 */

import type {
  ParsedAirport,
  ParsedBooking,
  ParsedFlightLeg,
  ParsedLocation,
  When,
} from '../../supabase/functions/_shared/parse/schema';
import type {
  Booking,
  Expense,
  ItemKind,
  ItineraryItem,
  LocalDateTime,
  NewTrip,
  Place,
  Trip,
} from '../services/data/types';
import { daysBetween } from './dates';
import { toMinor } from './money';
import { timezoneAt } from './timezone';

/** Where and when a booking happens: what trip matching and "create a trip" use. */
export interface BookingSpan {
  city: string | null;
  country: string | null;
  lat: number | null;
  lng: number | null;
  startDate: string;
  endDate: string;
}

/** Times a booking may leave out; the review screen flags them. */
const DEFAULT_TIME = {
  checkIn: '15:00',
  checkOut: '11:00',
  other: '12:00',
} as const;

const timeOr = (when: When, fallback: string) => when.time ?? fallback;

/**
 * Of a flight's legs, the one landing where the traveller stays: on a round trip the leg before
 * the longest time on the ground, otherwise the last.
 */
export function destinationLeg(legs: readonly ParsedFlightLeg[]): ParsedFlightLeg {
  const first = legs[0];
  const last = legs[legs.length - 1];
  if (legs.length === 1 || last.to.code !== first.from.code) return last;
  let best = 0;
  let bestGap = -Infinity;
  for (let i = 0; i < legs.length - 1; i += 1) {
    const gap = daysBetween(legs[i].arrives.date, legs[i + 1].departs.date);
    if (gap > bestGap) {
      bestGap = gap;
      best = i;
    }
  }
  return legs[best];
}

const span = (
  place: { city: string | null; country: string | null; lat: number | null; lng: number | null },
  startDate: string,
  endDate: string,
  name: string | null = null,
): BookingSpan => ({
  city: place.city ?? name,
  country: place.country,
  lat: place.lat,
  lng: place.lng,
  startDate,
  endDate: endDate < startDate ? startDate : endDate,
});

export function bookingSpan(booking: ParsedBooking): BookingSpan {
  switch (booking.type) {
    case 'flight': {
      const { legs } = booking;
      const stay = destinationLeg(legs);
      const roundTrip = legs.length > 1 && legs[legs.length - 1].to.code === legs[0].from.code;
      const end = roundTrip ? legs[legs.length - 1].departs.date : stay.arrives.date;
      return span(stay.to, legs[0].departs.date, end);
    }
    case 'hotel':
      return span(booking.hotel, booking.checkIn.date, booking.checkOut.date, null);
    case 'car':
      return span(booking.pickupLocation, booking.pickup.date, booking.dropoff.date);
    case 'ticket':
    case 'reservation':
      return span(booking.venue, booking.starts.date, booking.starts.date);
  }
}

const norm = (s: string | null | undefined) => (s ?? '').trim().toLowerCase();

/** Great-circle distance in km. */
function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/** How near a booking must be to a trip's city to count as the same place. */
const SAME_PLACE_KM = 80;

function samePlace(s: BookingSpan, trip: Trip): boolean {
  if (s.city && norm(s.city) === norm(trip.city)) return true;
  if (s.lat === null || s.lng === null || trip.lat === null || trip.lng === null) return false;
  return distanceKm({ lat: s.lat, lng: s.lng }, { lat: trip.lat, lng: trip.lng }) <= SAME_PLACE_KM;
}

/** Days the booking and the trip share, allowing a day either side (red-eyes, early check-ins). */
function overlapDays(s: BookingSpan, trip: Trip): number {
  const start = s.startDate > trip.startDate ? s.startDate : trip.startDate;
  const end = s.endDate < trip.endDate ? s.endDate : trip.endDate;
  return daysBetween(start, end) + 1;
}

/** The trip a booking belongs to: same destination, overlapping dates; the best overlap wins. */
export function matchTrip(s: BookingSpan, trips: readonly Trip[]): Trip | null {
  let best: Trip | null = null;
  let bestOverlap = -Infinity;
  for (const trip of trips) {
    if (!samePlace(s, trip)) continue;
    const overlap = overlapDays(s, trip);
    if (overlap < 0) continue;
    if (overlap > bestOverlap) {
      best = trip;
      bestOverlap = overlap;
    }
  }
  return best;
}

/**
 * The trip to offer when none matches ("Create Lisbon trip, Feb 12 – 16?"), without a cover
 * photo; null when the booking doesn't say where it is.
 */
export function proposedTrip(s: BookingSpan): NewTrip | null {
  if (!s.city || s.lat === null || s.lng === null) return null;
  return {
    city: s.city,
    country: s.country,
    lat: s.lat,
    lng: s.lng,
    timezone: timezoneAt(s.lat, s.lng),
    startDate: s.startDate,
    endDate: s.endDate,
    coverPhotoUrl: null,
    coverPhotoCredit: null,
  };
}

export interface ImportPlan {
  places: Place[];
  bookings: Booking[];
  items: ItineraryItem[];
  expenses: Expense[];
}

export interface PlanOptions {
  newId: () => string;
  /** The Storage path of the imported file, kept on every booking it made. */
  originalPath: string | null;
  /** When the import happened (ISO instant): the expense's paid-at. */
  importedAt: string;
}

/**
 * Everything to save for a reviewed booking in a trip. Itinerary items land only on the trip's
 * days, and only at airports in the trip's city (not at home or a connection).
 */
export function planImport(
  booking: ParsedBooking,
  trip: Trip,
  { newId, originalPath, importedAt }: PlanOptions,
): ImportPlan {
  const places: Place[] = [];
  const items: ItineraryItem[] = [];
  const zoneOf = (p: { lat: number | null; lng: number | null }) =>
    p.lat !== null && p.lng !== null ? timezoneAt(p.lat, p.lng) : trip.timezone;
  const at = (when: When, fallback: string, timezone: string): LocalDateTime => ({
    date: when.date,
    time: timeOr(when, fallback),
    timezone,
  });

  const addPlace = (
    name: string,
    kind: string,
    p: { lat: number | null; lng: number | null; address?: string | null },
  ): Place => {
    const place: Place = {
      id: newId(),
      name,
      address: p.address ?? null,
      lat: p.lat,
      lng: p.lng,
      kind,
      photoUrl: null,
      sourceUrl: null,
    };
    places.push(place);
    return place;
  };
  const venue = (l: ParsedLocation, kind: string) => addPlace(l.name, kind, l);

  const addItem = (
    bookingId: string,
    when: LocalDateTime,
    durationMinutes: number,
    placeId: string,
    kind: ItemKind,
    title: string,
  ) => {
    if (when.date < trip.startDate || when.date > trip.endDate) return;
    items.push({
      id: newId(),
      tripId: trip.id,
      day: when.date,
      startTime: when.time,
      durationMinutes,
      placeId,
      kind,
      bookingId,
      fixed: true,
      title,
    });
  };

  const base = (id: string) => ({ id, tripId: trip.id, originalPath });
  const bookings: Booking[] = [];
  let category: string;
  let description: string;

  switch (booking.type) {
    case 'flight': {
      const airports = new Map<string, Place>();
      const airport = (a: ParsedAirport) => {
        const known = airports.get(a.code);
        if (known) return known;
        const place = addPlace(`${a.city ? `${a.city} ` : ''}(${a.code})`, 'airport', a);
        airports.set(a.code, place);
        return place;
      };
      const legs = booking.legs;
      const homeCode = legs[0].from.code;
      // Airports in the trip's city get itinerary items; home and connections don't. Without a
      // city or coordinates to compare, everything but the starting airport counts.
      const nearTrip = (a: ParsedAirport) =>
        norm(a.city) === norm(trip.city) ||
        (a.lat !== null &&
          a.lng !== null &&
          trip.lat !== null &&
          trip.lng !== null &&
          distanceKm({ lat: a.lat, lng: a.lng }, { lat: trip.lat, lng: trip.lng }) <=
            SAME_PLACE_KM);
      const anyNear = legs.some((l) => nearTrip(l.from) || nearTrip(l.to));
      const onTrip = anyNear ? nearTrip : (a: ParsedAirport) => a.code !== homeCode;
      for (const leg of legs) {
        const id = newId();
        const from = airport(leg.from);
        const to = airport(leg.to);
        const departs = at(leg.departs, DEFAULT_TIME.other, zoneOf(leg.from));
        const arrives = at(leg.arrives, DEFAULT_TIME.other, zoneOf(leg.to));
        bookings.push({
          ...base(id),
          type: 'flight',
          data: {
            airline: leg.airline,
            airlineCode: leg.airlineCode ?? leg.flightNumber.replace(/[^A-Za-z]/g, '').slice(0, 2),
            flightNumber: leg.flightNumber,
            aircraft: null,
            from: { code: leg.from.code, city: leg.from.city ?? leg.from.code, placeId: from.id },
            to: { code: leg.to.code, city: leg.to.city ?? leg.to.code, placeId: to.id },
            departs,
            arrives,
            terminal: leg.terminal,
            gate: leg.gate,
            seat: leg.seat,
            boardingTime: null,
            boardingGroup: null,
            cabin: leg.cabin,
            confirmation: booking.confirmation ?? '',
            passenger: booking.passenger ?? '',
          },
        });
        const toCity = leg.to.city ?? leg.to.code;
        if (onTrip(leg.from)) {
          const title = leg.to.code === homeCode ? `Fly home to ${toCity}` : `Fly to ${toCity}`;
          addItem(id, departs, 30, from.id, 'flight', title);
        }
        if (onTrip(leg.to)) addItem(id, arrives, 30, to.id, 'flight', `Arrive in ${toCity}`);
      }
      category = 'Flights';
      description = legs.map((l) => l.flightNumber).join(' and ');
      break;
    }
    case 'hotel': {
      const id = newId();
      const hotel = venue(booking.hotel, 'hotel');
      const zone = zoneOf(booking.hotel);
      const checkIn = at(booking.checkIn, DEFAULT_TIME.checkIn, zone);
      const checkOut = at(booking.checkOut, DEFAULT_TIME.checkOut, zone);
      const name = booking.hotel.name;
      bookings.push({
        ...base(id),
        type: 'hotel',
        data: {
          name,
          placeId: hotel.id,
          checkIn,
          checkOut,
          confirmation: booking.confirmation ?? '',
          room: booking.room,
          address: booking.hotel.address ?? booking.hotel.city ?? '',
          phone: booking.phone,
          website: booking.website,
          email: booking.email,
        },
      });
      addItem(id, checkIn, 45, hotel.id, 'hotel', `Check in at ${name}`);
      addItem(id, checkOut, 20, hotel.id, 'hotel', `Check out of ${name}`);
      category = 'Hotels';
      description = name;
      break;
    }
    case 'car': {
      const id = newId();
      const pickupPlace = venue(booking.pickupLocation, 'car');
      const returnPlace = booking.returnLocation
        ? venue(booking.returnLocation, 'car')
        : pickupPlace;
      const pickup = at(booking.pickup, DEFAULT_TIME.other, zoneOf(booking.pickupLocation));
      const dropoff = at(
        booking.dropoff,
        DEFAULT_TIME.other,
        zoneOf(booking.returnLocation ?? booking.pickupLocation),
      );
      bookings.push({
        ...base(id),
        type: 'car',
        data: {
          company: booking.company,
          pickupPlaceId: pickupPlace.id,
          returnPlaceId: returnPlace.id,
          pickup,
          dropoff,
          confirmation: booking.confirmation ?? '',
          vehicle: booking.vehicle,
        },
      });
      addItem(id, pickup, 30, pickupPlace.id, 'car', 'Pick up rental car');
      addItem(id, dropoff, 25, returnPlace.id, 'car', 'Return rental car');
      category = 'Transport';
      description = `${booking.company} rental car`;
      break;
    }
    case 'ticket': {
      const id = newId();
      const place = venue(booking.venue, 'arena');
      const starts = at(booking.starts, DEFAULT_TIME.other, zoneOf(booking.venue));
      bookings.push({
        ...base(id),
        type: 'ticket',
        data: {
          event: booking.event,
          placeId: place.id,
          starts,
          section: booking.section,
          row: booking.row,
          seats: booking.seats,
          confirmation: booking.confirmation ?? '',
        },
      });
      addItem(id, starts, 180, place.id, 'event', booking.event);
      category = 'Activities';
      description = booking.event;
      break;
    }
    case 'reservation': {
      const id = newId();
      const place = venue(booking.venue, 'food');
      const starts = at(booking.starts, DEFAULT_TIME.other, zoneOf(booking.venue));
      const name = booking.venue.name;
      bookings.push({
        ...base(id),
        type: 'ticket',
        data: {
          event: name,
          placeId: place.id,
          starts,
          section: null,
          row: null,
          seats: booking.partySize ? `Table for ${booking.partySize}` : null,
          confirmation: booking.confirmation ?? '',
        },
      });
      addItem(id, starts, 90, place.id, 'food', `${mealAt(starts.time)} at ${name}`);
      category = 'Food & Drinks';
      description = name;
      break;
    }
  }

  const expenses: Expense[] = booking.price
    ? [
        {
          id: newId(),
          tripId: trip.id,
          amountMinor: toMinor(booking.price.amount, booking.price.currency),
          currency: booking.price.currency,
          category,
          bookingId: bookings[0].id,
          paidAt: importedAt,
          description,
        },
      ]
    : [];

  return { places, bookings, items, expenses };
}

/** Breakfast, lunch or dinner, from a `HH:MM` time. */
export function mealAt(time: string): string {
  const hour = Number(time.slice(0, 2));
  if (hour < 11) return 'Breakfast';
  if (hour < 16) return 'Lunch';
  return 'Dinner';
}

/** The first day the import adds to the plan, for the confirmation toast. */
export function firstPlannedDay(plan: ImportPlan): string | null {
  const days = plan.items.map((i) => i.day).sort();
  return days[0] ?? null;
}
