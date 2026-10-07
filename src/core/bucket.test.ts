import { DEFAULT_WINDOW, durationForKind, kindLabel, sourceLabel } from './bucket';

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
