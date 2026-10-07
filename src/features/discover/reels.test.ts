import { curatedLinkFor, curatedReels, mergeReels, type CityReel } from '@/services/cityLinks';

import { filterReels, placesLabel, viewLabel } from './reels';

const reel = (url: string, title: string | null = null): CityReel => ({
  url,
  title,
  thumbnailUrl: null,
  placeCount: 2,
  viewCount: null,
});

describe('viewLabel', () => {
  it('shortens counts like the mockup', () => {
    expect(viewLabel(950)).toBe('950');
    expect(viewLabel(1000)).toBe('1K');
    expect(viewLabel(12_500)).toBe('13K');
    expect(viewLabel(9_450)).toBe('9.5K');
    expect(viewLabel(845_000)).toBe('845K');
    expect(viewLabel(999_600)).toBe('1M');
    expect(viewLabel(1_200_000)).toBe('1.2M');
    expect(viewLabel(23_000_000)).toBe('23M');
  });
});

describe('placesLabel', () => {
  it('counts places', () => {
    expect(placesLabel(1)).toBe('1 place');
    expect(placesLabel(4)).toBe('4 places');
  });
});

describe('filterReels', () => {
  it('matches the caption, ignoring case and spaces', () => {
    const reels = [reel('a', 'Hidden gems in Vegas'), reel('b', 'Best tacos'), reel('c')];
    expect(filterReels(reels, '')).toEqual(reels);
    expect(filterReels(reels, '  GEMS ').map((r) => r.url)).toEqual(['a']);
  });
});

describe('the handpicked Las Vegas videos', () => {
  it('are there for Las Vegas only, with view counts where known', () => {
    const vegas = curatedReels(' las vegas ');
    expect(vegas.length).toBeGreaterThanOrEqual(3);
    expect(vegas[0]).toMatchObject({
      title: '5 best restaurants in Vegas',
      placeCount: 5,
      viewCount: 1_200_000,
    });
    expect(vegas.some((r) => r.viewCount === null)).toBe(true);
    for (const r of vegas) expect(r.placeCount).toBeGreaterThan(0);
    expect(curatedReels('Cape Town')).toEqual([]);
  });

  it('open with their places, as a copy', () => {
    const [first] = curatedReels('Las Vegas');
    const result = curatedLinkFor(first.url);
    expect(result?.places.map((p) => p.name)).toContain('Lotus of Siam');
    result?.places.pop();
    expect(curatedLinkFor(first.url)?.places).toHaveLength(5);
    expect(curatedLinkFor('https://www.tiktok.com/@someone/video/1')).toBeNull();
  });

  it('come first; travellers’ videos follow without repeats', () => {
    const curated = [reel('a'), reel('b')];
    expect(mergeReels(curated, [reel('b'), reel('c')]).map((r) => r.url)).toEqual(['a', 'b', 'c']);
  });
});
