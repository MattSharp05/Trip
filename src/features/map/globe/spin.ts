import type { LngLat } from '../types';

/**
 * The slow auto-rotation of a globe (TR-16), moved from JS: the camera's centre longitude drifts
 * west so the surface turns the way the Earth does. Pure maths here; `useGlobeSpin` drives it.
 */
export const spin = {
  /** About two minutes per turn. */
  degreesPerSecond: 3,
  /** Camera updates per second while spinning. */
  fps: 30,
  /** Wait after the finger lifts before spinning again, so the drag's inertia settles first. */
  resumeAfterMs: 1500,
} as const;

/** Longitude wrapped into [-180, 180). */
export function wrapLng(lng: number): number {
  if (lng >= -180 && lng < 180) return lng;
  return ((((lng + 180) % 360) + 360) % 360) - 180;
}

/** The centre longitude `elapsedMs` later. */
export function spinLng(lng: number, elapsedMs: number): number {
  return wrapLng(lng - (spin.degreesPerSecond * elapsedMs) / 1000);
}

/** The camera never centres beyond these latitudes, so the globe stays upright and readable. */
const LAT_LIMIT = 35;

/**
 * Where the globe looks first: at `first` (the next trip) when there is one, else at the Atlantic.
 * Latitude is kept moderate so polar trips don't tip the globe over.
 */
export function startCenter(first: LngLat | undefined): LngLat {
  if (!first) return { lat: 20, lng: -30 };
  return { lat: Math.max(-LAT_LIMIT, Math.min(LAT_LIMIT, first.lat)), lng: wrapLng(first.lng) };
}
