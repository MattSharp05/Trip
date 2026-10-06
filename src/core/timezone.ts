import tzLookup from 'tz-lookup';

/**
 * The IANA timezone at a point, offline (tz-lookup, ADR 0010): a new trip stores its
 * destination's zone so its days and times read in local time. Falls back to UTC for points the
 * lookup rejects (out-of-range coordinates).
 */
export function timezoneAt(lat: number, lng: number): string {
  try {
    return tzLookup(lat, lng);
  } catch {
    return 'UTC';
  }
}
