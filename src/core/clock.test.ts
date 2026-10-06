import { isClockFixed, now, setNow } from './clock';

describe('clock', () => {
  afterEach(() => setNow(null));

  it('follows real time by default', () => {
    expect(isClockFixed()).toBe(false);
    expect(Math.abs(now().getTime() - Date.now())).toBeLessThan(1000);
  });

  it('can be pinned to an instant with an offset', () => {
    setNow('2026-11-13T09:00:00-08:00');
    expect(isClockFixed()).toBe(true);
    expect(now().toISOString()).toBe('2026-11-13T17:00:00.000Z');
  });

  it('returns a copy, so callers cannot move the pinned time', () => {
    setNow(new Date('2026-11-13T17:00:00Z'));
    now().setFullYear(2000);
    expect(now().getUTCFullYear()).toBe(2026);
  });

  it('rejects an invalid instant', () => {
    expect(() => setNow('not a date')).toThrow('Invalid instant');
  });
});
