import type { LngLat } from './types';

/** react-native-maps coordinates. */
export const latLng = ({ lat, lng }: LngLat) => ({ latitude: lat, longitude: lng });

export interface Bounds {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

/** react-native-maps `Region`: a centre and the span shown, in degrees. */
export interface Region {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

/** The box around `points`, or null when there are none. Trips don't cross the antimeridian. */
export function boundsOf(points: LngLat[]): Bounds | null {
  if (points.length === 0) return null;
  let [minLat, maxLat, minLng, maxLng] = [Infinity, -Infinity, Infinity, -Infinity];
  for (const { lat, lng } of points) {
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
    minLng = Math.min(minLng, lng);
    maxLng = Math.max(maxLng, lng);
  }
  return { minLat, maxLat, minLng, maxLng };
}

export interface RegionOptions {
  /** Span multiplier, so edge pins (and the selected pin's label) aren't cut off. */
  padding?: number;
  /** Smallest span in degrees (about 1 km), so one pin doesn't zoom to street level. */
  minDelta?: number;
}

/** The region that shows every point with padding, or null when there are none. */
export function regionFor(
  points: LngLat[],
  { padding = 1.6, minDelta = 0.01 }: RegionOptions = {},
): Region | null {
  const b = boundsOf(points);
  if (!b) return null;
  return {
    latitude: (b.minLat + b.maxLat) / 2,
    longitude: (b.minLng + b.maxLng) / 2,
    latitudeDelta: Math.min(Math.max((b.maxLat - b.minLat) * padding, minDelta), 180),
    longitudeDelta: Math.min(Math.max((b.maxLng - b.minLng) * padding, minDelta), 360),
  };
}
