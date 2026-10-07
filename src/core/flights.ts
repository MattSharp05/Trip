/**
 * Flights on the globe (TR-23): the great-circle arc between two airports, the plane's position
 * and heading along it, which flight a travel day has, and where the camera looks. Pure
 * TypeScript, no React Native. The globe's maths started in the TR-5 spike's `geo.ts`, which now
 * re-exports it from here.
 */
import type { FlightData, ItineraryItem, Place, TripData } from '@/services/data/types';

/** A point on the Earth, in degrees. */
export interface GeoPoint {
  lat: number;
  lng: number;
}

const rad = (deg: number) => (deg * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

/** The angle between two points seen from the Earth's centre, in radians (haversine). */
function angularDistance(a: GeoPoint, b: GeoPoint): number {
  const [φ1, λ1, φ2, λ2] = [rad(a.lat), rad(a.lng), rad(b.lat), rad(b.lng)];
  return (
    2 *
    Math.asin(
      Math.sqrt(
        Math.sin((φ2 - φ1) / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin((λ2 - λ1) / 2) ** 2,
      ),
    )
  );
}

/**
 * Points along the great circle from `a` to `b` (spherical interpolation), endpoints included.
 * The globe's flight arc is drawn from these.
 */
export function greatCircle(a: GeoPoint, b: GeoPoint, segments = 64): GeoPoint[] {
  const [φ1, λ1, φ2, λ2] = [rad(a.lat), rad(a.lng), rad(b.lat), rad(b.lng)];
  const d = angularDistance(a, b);
  if (d === 0) return [a, b];
  const points: GeoPoint[] = [];
  for (let i = 0; i <= segments; i++) {
    const f = i / segments;
    const A = Math.sin((1 - f) * d) / Math.sin(d);
    const B = Math.sin(f * d) / Math.sin(d);
    const x = A * Math.cos(φ1) * Math.cos(λ1) + B * Math.cos(φ2) * Math.cos(λ2);
    const y = A * Math.cos(φ1) * Math.sin(λ1) + B * Math.cos(φ2) * Math.sin(λ2);
    const z = A * Math.sin(φ1) + B * Math.sin(φ2);
    points.push({ lat: deg(Math.atan2(z, Math.hypot(x, y))), lng: deg(Math.atan2(y, x)) });
  }
  return points;
}

/** Initial compass bearing from `a` to `b`, 0–360° clockwise from north. */
export function bearing(a: GeoPoint, b: GeoPoint): number {
  const [φ1, φ2, Δλ] = [rad(a.lat), rad(b.lat), rad(b.lng - a.lng)];
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (deg(Math.atan2(y, x)) + 360) % 360;
}

/** Position and heading at fraction `t` (0–1) along a polyline, for the moving plane. */
export function along(path: GeoPoint[], t: number): { at: GeoPoint; heading: number } {
  if (path.length < 2) return { at: path[0], heading: 0 };
  const last = path.length - 1;
  const pos = Math.min(Math.max(t, 0), 1) * last;
  const i = Math.min(Math.floor(pos), last - 1);
  const f = pos - i;
  const p = path[i];
  const q = path[i + 1];
  return {
    at: { lat: p.lat + (q.lat - p.lat) * f, lng: p.lng + (q.lng - p.lng) * f },
    heading: bearing(p, q),
  };
}

/** One end of a flight on the globe. */
export interface FlightEnd extends GeoPoint {
  code: string;
  city: string;
}

/** A day's flight: the itinerary item, its booking and both airports placed on the Earth. */
export interface DayFlight {
  itemId: string;
  bookingId: string;
  flight: FlightData;
  from: FlightEnd;
  to: FlightEnd;
}

const end = (airport: FlightData['from'], places: readonly Place[]): FlightEnd | null => {
  const place = places.find((p) => p.id === airport.placeId);
  if (!place || place.lat === null || place.lng === null) return null;
  return { lat: place.lat, lng: place.lng, code: airport.code, city: airport.city };
};

/**
 * The flight on `day`: the day's first flight item (by time) whose booking is a flight with both
 * airports on the map. Null on a day without one. Connections are out of scope (one leg a day).
 */
export function dayFlight(
  data: Pick<TripData, 'items' | 'bookings' | 'places'>,
  day: string,
): DayFlight | null {
  const items = data.items
    .filter((i): i is ItineraryItem & { bookingId: string } => {
      return i.day === day && i.kind === 'flight' && i.bookingId !== null;
    })
    .sort((a, b) => (a.startTime ?? '').localeCompare(b.startTime ?? ''));
  for (const item of items) {
    const booking = data.bookings.find((b) => b.id === item.bookingId);
    if (booking?.type !== 'flight') continue;
    const from = end(booking.data.from, data.places);
    const to = end(booking.data.to, data.places);
    if (from && to)
      return { itemId: item.id, bookingId: booking.id, flight: booking.data, from, to };
  }
  return null;
}

/** Camera height in metres for the shortest and longest flights: the whole route always fits. */
const MIN_ALTITUDE = 4_000_000;
const MAX_ALTITUDE = 24_000_000;
/** Metres of altitude per radian of route: a 3,600 km flight sits about 11,000 km up. */
const ALTITUDE_PER_RADIAN = 20_000_000;

/**
 * Where the globe's camera looks for a route: straight down on the arc's midpoint, high enough
 * that both airports show with room around them.
 */
export function routeCamera(from: GeoPoint, to: GeoPoint): { center: GeoPoint; altitude: number } {
  const arc = greatCircle(from, to, 2);
  const altitude = angularDistance(from, to) * ALTITUDE_PER_RADIAN;
  return {
    center: arc[1],
    altitude: Math.round(Math.min(MAX_ALTITUDE, Math.max(MIN_ALTITUDE, altitude))),
  };
}

/** The plane flies the arc in `flightMs`, then waits at the gate until `loopMs`. */
export const planeTiming = { flightMs: 7000, loopMs: 8000 } as const;

/**
 * How far along the arc the plane is, `elapsedMs` after the globe opened: 0 to 1 over `flightMs`,
 * held at 1 until the loop starts again. With Reduce Motion it stays at the midpoint.
 */
export function planeProgress(elapsedMs: number, reduceMotion: boolean): number {
  if (reduceMotion) return 0.5;
  return (
    Math.min(Math.max(elapsedMs, 0) % planeTiming.loopMs, planeTiming.flightMs) /
    planeTiming.flightMs
  );
}
