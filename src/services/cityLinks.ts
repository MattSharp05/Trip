import { useQuery } from '@tanstack/react-query';

import { linkResultSchema, type LinkResult } from '../../supabase/functions/_shared/parse/links';
import curatedJson from '../../supabase/seed/vegas_links.json';
import { useDataSource } from '@/services/data';
import { queryClient } from '@/services/data/hooks';

/** One video in Discover's "Saved from TikTok & Reels" row (TR-34). */
export interface CityReel {
  url: string;
  /** The caption; null when the platform didn't share one. */
  title: string | null;
  thumbnailUrl: string | null;
  /** How many places the video names. */
  placeCount: number;
  /** Views, for the handpicked samples that know it; null otherwise (not shown). */
  viewCount: number | null;
}

/** Required on first use, so demo sessions and tests never create a Supabase client. */
const client = (): (typeof import('./supabase'))['supabase'] =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('./supabase').supabase;

const norm = (city: string) => city.trim().toLowerCase();

interface Curated {
  reel: CityReel;
  result: LinkResult;
}

/** The handpicked Las Vegas videos (`supabase/seed/vegas_links.json`), checked once. */
const CURATED: { city: string; reels: Curated[] } = {
  city: curatedJson.city,
  reels: curatedJson.reels.flatMap((entry) => {
    const parsed = linkResultSchema.safeParse(entry.result);
    if (!parsed.success) return [];
    const result = parsed.data;
    return [
      {
        result,
        reel: {
          url: result.url,
          title: result.title,
          thumbnailUrl: result.thumbnailUrl,
          placeCount: result.places.length,
          viewCount: entry.viewCount ?? null,
        },
      },
    ];
  }),
};

/** The handpicked videos for a city (only Las Vegas has some). */
export function curatedReels(city: string): CityReel[] {
  return norm(city) === norm(CURATED.city) ? CURATED.reels.map((c) => c.reel) : [];
}

/**
 * A handpicked video's places, so tapping it opens the results sheet without reading it (its
 * link is made up). A copy: the sheet's edits never change the samples.
 */
export function curatedLinkFor(url: string): LinkResult | null {
  const found = CURATED.reels.find((c) => c.result.url === url.trim());
  return found ? (JSON.parse(JSON.stringify(found.result)) as LinkResult) : null;
}

/** Handpicked videos first, then travellers' ones the samples don't already have. */
export function mergeReels(curated: readonly CityReel[], pooled: readonly CityReel[]): CityReel[] {
  const urls = new Set(curated.map((r) => r.url));
  return [...curated, ...pooled.filter((r) => !urls.has(r.url))];
}

/**
 * Videos travellers saved for this city, from every account: `city_links` (migration 0009)
 * answers only each video's URL, caption, thumbnail and place count.
 */
export async function fetchCityLinks(city: string): Promise<CityReel[]> {
  const { data, error } = await client().rpc('city_links', { p_city: city });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    url: row.url,
    title: row.title ?? null,
    thumbnailUrl: row.thumbnail_url ?? null,
    placeCount: row.place_count ?? 0,
    viewCount: null,
  }));
}

/** Pooled answers change slowly; a few minutes is fresh enough. */
export const CITY_LINKS_STALE_MS = 10 * 60 * 1000;

/**
 * The "Saved from TikTok & Reels" row for a trip's city. Demo sessions (scenarios) show the
 * handpicked samples only and never ask Supabase; if the pooled list can't load, the samples
 * still show.
 */
export function useCityReels(city: string | null | undefined) {
  const source = useDataSource();
  const demo = source.kind === 'demo';
  return useQuery(
    {
      queryKey: ['city-links', source.id, city ? norm(city) : null],
      queryFn: async (): Promise<CityReel[]> => {
        if (!city) return [];
        const curated = curatedReels(city);
        if (demo) return curated;
        const pooled = await fetchCityLinks(city).catch(() => []);
        return mergeReels(curated, pooled);
      },
      enabled: !!city,
      staleTime: CITY_LINKS_STALE_MS,
    },
    queryClient,
  );
}
