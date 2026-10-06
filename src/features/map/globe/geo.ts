import type { LngLat } from '../types';

const rad = (deg: number) => (deg * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

/**
 * Points along the great circle from `a` to `b` (spherical interpolation), endpoints included.
 * The globe's flight arc is drawn from these.
 */
export function greatCircle(a: LngLat, b: LngLat, segments = 64): LngLat[] {
  const [φ1, λ1, φ2, λ2] = [rad(a.lat), rad(a.lng), rad(b.lat), rad(b.lng)];
  const d =
    2 *
    Math.asin(
      Math.sqrt(
        Math.sin((φ2 - φ1) / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin((λ2 - λ1) / 2) ** 2,
      ),
    );
  if (d === 0) return [a, b];
  const points: LngLat[] = [];
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
export function bearing(a: LngLat, b: LngLat): number {
  const [φ1, φ2, Δλ] = [rad(a.lat), rad(b.lat), rad(b.lng - a.lng)];
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (deg(Math.atan2(y, x)) + 360) % 360;
}

/** Position and heading at fraction `t` (0–1) along a polyline, for the moving plane. */
export function along(path: LngLat[], t: number): { at: LngLat; heading: number } {
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
