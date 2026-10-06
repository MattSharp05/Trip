import { devToolsEnabled } from './devTools';

describe('devToolsEnabled', () => {
  it('is on by default (demo phase)', () => {
    expect(devToolsEnabled(undefined)).toBe(true);
  });

  it('is off when EXPO_PUBLIC_SCENARIOS=off', () => {
    expect(devToolsEnabled('off')).toBe(false);
  });
});
