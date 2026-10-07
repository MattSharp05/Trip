/**
 * Travel-time estimates between two places (TDD → Risks 5): no routing API, just the straight-line
 * distance stretched for streets. Used by the itinerary's legs and by Smart Add's ordering.
 * Pure TypeScript, no React Native.
 *
 * - route distance = haversine distance × `DETOUR`
 * - up to `WALK_LIMIT_KM` of route: a walk at `WALK_KMH`
 * - further: a drive at `DRIVE_KMH` (an urban average) plus `DRIVE_OVERHEAD_MIN` (parking, pickup)
 * - minutes are rounded to the nearest whole minute, never below 1
 */

export interface LatLng {
  lat: number;
  lng: number;
}

export type TravelMode = 'walk' | 'drive';

/** Road distances are shown in the traveller's unit (Settings → Distance). */
export type DistanceUnit = 'miles' | 'km';

export interface TravelEstimate {
  mode: TravelMode;
  minutes: number;
  /** The estimated route length (straight line × detour), in km. */
  distanceKm: number;
}

export const DETOUR = 1.3;
export const WALK_LIMIT_KM = 1.6;
export const WALK_KMH = 4.8;
export const DRIVE_KMH = 30;
export const DRIVE_OVERHEAD_MIN = 5;

const EARTH_RADIUS_KM = 6371;
const KM_PER_MILE = 1.609344;
const rad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle (haversine) distance between two points, in km. */
export function distanceKm(a: LatLng, b: LatLng): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** How long getting from `from` to `to` takes, and whether that's a walk or a drive. */
export function travelEstimate(from: LatLng, to: LatLng): TravelEstimate {
  const route = distanceKm(from, to) * DETOUR;
  const walk = route <= WALK_LIMIT_KM;
  const exact = walk ? (route / WALK_KMH) * 60 : (route / DRIVE_KMH) * 60 + DRIVE_OVERHEAD_MIN;
  return {
    mode: walk ? 'walk' : 'drive',
    minutes: Math.max(1, Math.round(exact)),
    distanceKm: route,
  };
}

/**
 * Free minutes between a stop (starting at `startTime`, `HH:MM`, lasting `durationMinutes`) and
 * the next one at `nextStartTime`, on the same day. Negative when they overlap.
 */
export function gapMinutes(startTime: string, durationMinutes: number, nextStartTime: string) {
  return clockMinutes(nextStartTime) - clockMinutes(startTime) - durationMinutes;
}

/** True when the trip takes longer than the time there is for it. */
export const isTight = (estimate: TravelEstimate, gap: number) => estimate.minutes > gap;

/** "6 min", "1 hr", "1 hr 25 min" */
export function durationLabel(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`;
}

/** "0.2 mi", "1.4 km", "2 mi", "12 mi": at most one decimal, none from 10 up. */
export function distanceLabel(km: number, unit: DistanceUnit): string {
  const value = Math.round((unit === 'miles' ? km / KM_PER_MILE : km) * 10) / 10;
  const shown = value < 10 ? String(value) : String(Math.round(value));
  return `${shown} ${unit === 'miles' ? 'mi' : 'km'}`;
}

/** "6 min walk", "1 hr 5 min drive" */
export const travelLabel = (estimate: TravelEstimate) =>
  `${durationLabel(estimate.minutes)} ${estimate.mode}`;

function clockMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}
