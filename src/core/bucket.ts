/**
 * Bucket List rules (PRD → Plan → Bucket List): how long a visit takes and when a place is open,
 * for Smart Add (TR-29) to place it, and the line saying where an item came from.
 */

/** Used when OpenStreetMap has no opening hours for the place. */
export const DEFAULT_WINDOW = { start: '09:00', end: '22:00' } as const;

/** Minutes a visit usually takes, by place kind. */
const DURATIONS: Record<string, number> = {
  food: 75,
  bar: 90,
  nightlife: 180,
  arena: 180,
  attraction: 90,
  landmark: 60,
  hotel: 60,
  activity: 120,
};
const DEFAULT_DURATION = 60;

export function durationForKind(kind: string | null): number {
  return (kind && DURATIONS[kind]) || DEFAULT_DURATION;
}

/** Where a bucket item came from, as the row's last line; null when unknown. */
export function sourceLabel(source: string | null): string | null {
  switch (source) {
    case 'tiktok':
      return 'Saved from TikTok';
    case 'instagram':
      return 'Saved from Instagram';
    case 'discover':
      return 'From Discover';
    case 'search':
      return 'From search';
    case 'pin':
      return 'Dropped pin';
    default:
      return null;
  }
}

/** "Food", "Nightlife": a place kind as the row shows it. */
export function kindLabel(kind: string | null): string | null {
  return kind ? kind.charAt(0).toUpperCase() + kind.slice(1) : null;
}
