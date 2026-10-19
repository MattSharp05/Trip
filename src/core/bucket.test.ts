import {
  DEFAULT_WINDOW,
  durationForKind,
  kindLabel,
  likeCount,
  sortBucket,
  sourceLabel,
  withLike,
} from './bucket';

describe('bucket rules', () => {
  it('estimates a visit by kind, an hour when unknown', () => {
    expect(durationForKind('food')).toBe(75);
    expect(durationForKind('nightlife')).toBe(180);
    expect(durationForKind('museum')).toBe(60);
    expect(durationForKind(null)).toBe(60);
  });

  it('opens 9:00 to 22:00 by default', () => {
    expect(DEFAULT_WINDOW).toEqual({ start: '09:00', end: '22:00' });
  });

  it('says where an item came from', () => {
    expect(sourceLabel('tiktok')).toBe('Saved from TikTok');
    expect(sourceLabel('discover')).toBe('From Discover');
    expect(sourceLabel('search')).toBe('From search');
    expect(sourceLabel('pin')).toBe('Dropped pin');
    expect(sourceLabel(null)).toBeNull();
  });

  it('labels kinds', () => {
    expect(kindLabel('nightlife')).toBe('Nightlife');
    expect(kindLabel(null)).toBeNull();
  });
});

describe('Bucket List likes and order (TR-59)', () => {
  // In the order they were saved: a is the oldest.
  const items = [
    { id: 'a', likedBy: ['blake'] },
    { id: 'b' },
    { id: 'sphere', likedBy: ['blake', 'willem'] },
    { id: 'c', likedBy: [] },
    { id: 'carbone', likedBy: ['blake'] },
  ];
  const ids = (list: { id: string }[]) => list.map((i) => i.id);

  it('Recent is newest first', () => {
    expect(ids(sortBucket(items, 'recent'))).toEqual(['carbone', 'c', 'sphere', 'b', 'a']);
  });

  it('Popular is most likes first, then newest', () => {
    expect(ids(sortBucket(items, 'popular'))).toEqual(['sphere', 'carbone', 'a', 'c', 'b']);
  });

  it("doesn't reorder its input", () => {
    sortBucket(items, 'popular');
    expect(ids(items)).toEqual(['a', 'b', 'sphere', 'c', 'carbone']);
  });

  it('counts likes, none when absent', () => {
    expect(likeCount(items[2])).toBe(2);
    expect(likeCount(items[1])).toBe(0);
  });

  it('adds your like once and removes it, dropping an empty list', () => {
    const liked = withLike(items, 'b', 'me', true);
    expect(liked[1]).toEqual({ id: 'b', likedBy: ['me'] });
    expect(withLike(liked, 'b', 'me', true)[1]).toEqual({ id: 'b', likedBy: ['me'] });
    expect(withLike(liked, 'b', 'me', false)[1]).toEqual({ id: 'b' });
    expect(withLike(items, 'sphere', 'blake', false)[2]).toEqual({
      id: 'sphere',
      likedBy: ['willem'],
    });
    expect(liked[0]).toBe(items[0]);
  });
});
