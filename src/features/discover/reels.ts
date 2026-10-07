import type { CityReel } from '@/services/cityLinks';

/** "950", "12.5K", "845K", "1.2M": the view count on a reel's thumbnail. */
export function viewLabel(count: number): string {
  const short = (value: number, unit: string) => {
    const rounded = value < 10 ? Math.round(value * 10) / 10 : Math.round(value);
    return `${rounded}${unit}`;
  };
  if (count < 1000) return String(Math.max(0, Math.round(count)));
  if (count < 999_500) return short(count / 1000, 'K');
  return short(count / 1_000_000, 'M');
}

/** "1 place", "4 places". */
export const placesLabel = (count: number) => (count === 1 ? '1 place' : `${count} places`);

/** Reels whose caption matches the search. */
export function filterReels(reels: readonly CityReel[], query: string): CityReel[] {
  const q = query.trim().toLowerCase();
  return q ? reels.filter((r) => (r.title ?? '').toLowerCase().includes(q)) : [...reels];
}
