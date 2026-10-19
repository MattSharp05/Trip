/**
 * Who lands and who leaves when (TR-58): every member's flight legs into and out of the trip's
 * city, grouped by airport and day and sorted by the moment they land or take off, with a pickup
 * hint for travellers landing (or leaving) within an hour of each other at the same airport. Pure
 * TypeScript, no React Native.
 */
import type { Airport, Place, Trip, TripFlight } from '@/services/data/types';

import { instantIn, timeLabel } from './dates';
import { distanceKm } from './travel';

export type FlightDirection = 'arrival' | 'departure';

/** One traveller landing at (or leaving from) one of the trip's airports. */
export interface FlightMove {
  bookingId: string;
  travelerId: string;
  flightNumber: string;
  /** The airport's IATA code. */
  airport: string;
  /** Local wall-clock date and time at that airport. */
  day: string;
  time: string;
  /** The moment itself (ISO, UTC), for sorting across timezones. */
  instant: string;
}

/** Travellers close enough together to share a pickup (or a ride to the airport). */
export interface PickupHint {
  travelerIds: string[];
  /** From the first of them to the last. */
  minutes: number;
}

/** Everyone landing at (or leaving from) one airport on one day, first first. */
export interface AirportMoves {
  direction: FlightDirection;
  day: string;
  airport: string;
  moves: FlightMove[];
  hints: PickupHint[];
}

export interface TripMoves {
  arrivals: AirportMoves[];
  departures: AirportMoves[];
}

/** Within this many minutes of each other, travellers get a pickup hint. */
export const PICKUP_WINDOW_MIN = 60;
/** How near the trip's city an airport must be to count as the trip's (same as imports, 80 km). */
const DESTINATION_KM = 80;

const norm = (s: string) => s.trim().toLowerCase();

/**
 * Whether an airport serves the trip's city: the same city name, or (when the airport is a place
 * on the map) within 80 km of the trip's centre.
 */
export function atDestination(
  airport: Airport,
  trip: Pick<Trip, 'city' | 'lat' | 'lng'>,
  places: readonly Pick<Place, 'id' | 'lat' | 'lng'>[],
): boolean {
  if (norm(airport.city) === norm(trip.city)) return true;
  const place = places.find((p) => p.id === airport.placeId);
  if (!place || place.lat === null || place.lng === null || trip.lat === null || trip.lng === null)
    return false;
  return (
    distanceKm({ lat: place.lat, lng: place.lng }, { lat: trip.lat, lng: trip.lng }) <=
    DESTINATION_KM
  );
}

/** The moment of a local date and time, or null when either (or the zone) doesn't parse. */
function momentOf(at: TripFlight['arrives']): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(at.date) || !/^\d{2}:\d{2}$/.test(at.time)) return null;
  try {
    return instantIn(at.timezone, at.date, at.time);
  } catch {
    return null;
  }
}

const minutesBetween = (a: string, b: string) =>
  Math.round((Date.parse(b) - Date.parse(a)) / 60_000);

/**
 * Runs of travellers all within the window of the run's first; a run of one isn't a hint. So a
 * hint never spans more than the hour, however many land in it.
 */
function pickupHints(moves: readonly FlightMove[]): PickupHint[] {
  const hints: PickupHint[] = [];
  let run: FlightMove[] = [];
  const close = () => {
    const travelerIds = [...new Set(run.map((m) => m.travelerId))];
    if (travelerIds.length > 1) {
      hints.push({
        travelerIds,
        minutes: minutesBetween(run[0].instant, run[run.length - 1].instant),
      });
    }
  };
  for (const move of moves) {
    const first = run[0];
    if (first && minutesBetween(first.instant, move.instant) > PICKUP_WINDOW_MIN) {
      close();
      run = [];
    }
    run.push(move);
  }
  close();
  return hints;
}

function group(direction: FlightDirection, moves: FlightMove[]): AirportMoves[] {
  const groups = new Map<string, FlightMove[]>();
  for (const move of moves) {
    const key = `${move.day} ${move.airport}`;
    groups.set(key, [...(groups.get(key) ?? []), move]);
  }
  return [...groups.values()]
    .map((list) => {
      const sorted = [...list].sort(
        (a, b) => a.instant.localeCompare(b.instant) || a.travelerId.localeCompare(b.travelerId),
      );
      return {
        direction,
        day: sorted[0].day,
        airport: sorted[0].airport,
        moves: sorted,
        hints: pickupHints(sorted),
      };
    })
    .sort((a, b) => a.moves[0].instant.localeCompare(b.moves[0].instant));
}

/**
 * Every member's legs landing at the trip's airports (arrivals) and taking off from them
 * (departures), grouped by airport and local day.
 */
export function tripMoves(
  flights: readonly TripFlight[],
  trip: Pick<Trip, 'city' | 'lat' | 'lng'>,
  places: readonly Pick<Place, 'id' | 'lat' | 'lng'>[],
): TripMoves {
  const move = (f: TripFlight, airport: Airport, at: TripFlight['arrives']): FlightMove[] => {
    // Another member's booking can hold anything: a leg with a time or zone that doesn't parse is
    // left out rather than breaking everyone's Plan.
    const instant = momentOf(at);
    if (!instant) return [];
    const { bookingId, travelerId, flightNumber } = f;
    return [
      {
        bookingId,
        travelerId,
        flightNumber,
        airport: airport.code,
        day: at.date,
        time: at.time,
        instant,
      },
    ];
  };
  const here = (airport: Airport) => atDestination(airport, trip, places);
  return {
    arrivals: group(
      'arrival',
      flights.filter((f) => here(f.to)).flatMap((f) => move(f, f.to, f.arrives)),
    ),
    departures: group(
      'departure',
      flights.filter((f) => here(f.from)).flatMap((f) => move(f, f.from, f.departs)),
    ),
  };
}

/** The arrivals and departures on one day of the trip. */
export function dayMoves(moves: TripMoves, day: string): TripMoves {
  return {
    arrivals: moves.arrivals.filter((g) => g.day === day),
    departures: moves.departures.filter((g) => g.day === day),
  };
}

/** "lands 2:10 PM LAS", "leaves 1:45 PM LAS" */
export function moveLabel(direction: FlightDirection, move: FlightMove): string {
  return `${direction === 'arrival' ? 'lands' : 'leaves'} ${timeLabel(move.time)} ${move.airport}`;
}

/** "Blake and Willem", "Matthew, Blake and Willem" */
function namesLine(names: readonly string[]): string {
  return names.length < 2
    ? (names[0] ?? '')
    : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/**
 * The pickup hint under a card: "Blake and Willem land 35 min apart at LAS"; three or more
 * "land within 50 min at LAS"; departures "leave 20 min apart from LAS".
 */
export function hintLine(
  group: Pick<AirportMoves, 'direction' | 'airport'>,
  hint: PickupHint,
  nameOf: (travelerId: string) => string,
): string {
  const arriving = group.direction === 'arrival';
  const verb = arriving ? 'land' : 'leave';
  const where = `${arriving ? 'at' : 'from'} ${group.airport}`;
  const names = namesLine(hint.travelerIds.map(nameOf));
  if (hint.minutes === 0) return `${names} ${verb} at the same time ${where}`;
  const gap =
    hint.travelerIds.length > 2 ? `within ${hint.minutes} min` : `${hint.minutes} min apart`;
  return `${names} ${verb} ${gap} ${where}`;
}
