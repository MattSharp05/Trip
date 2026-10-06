import { spin, spinLng, startCenter, wrapLng } from './spin';

describe('wrapLng', () => {
  it('keeps longitudes in [-180, 180)', () => {
    expect(wrapLng(0)).toBe(0);
    expect(wrapLng(190)).toBe(-170);
    expect(wrapLng(-190)).toBe(170);
    expect(wrapLng(180)).toBe(-180);
    expect(wrapLng(540)).toBe(-180);
  });
});

describe('spinLng', () => {
  it('drifts west at the spin speed', () => {
    expect(spinLng(0, 1000)).toBeCloseTo(-spin.degreesPerSecond);
    expect(spinLng(10, 0)).toBe(10);
  });

  it('wraps across the date line', () => {
    expect(spinLng(-179, 1000)).toBeCloseTo(181 - spin.degreesPerSecond);
    expect(spinLng(-179, 1000)).toBeGreaterThan(170);
  });
});

describe('startCenter', () => {
  it('looks at the first trip', () => {
    expect(startCenter({ lat: 27.9, lng: -115.2 })).toEqual({ lat: 27.9, lng: -115.2 });
  });

  it('keeps the latitude moderate', () => {
    expect(startCenter({ lat: 64.1, lng: -21.9 }).lat).toBe(35);
    expect(startCenter({ lat: -77.8, lng: 166.7 }).lat).toBe(-35);
  });

  it('falls back to the Atlantic with no trips', () => {
    expect(startCenter(undefined)).toEqual({ lat: 20, lng: -30 });
  });
});
