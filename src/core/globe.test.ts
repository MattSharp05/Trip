import { globeAltitude } from './globe';

describe('globeAltitude', () => {
  it("keeps TR-16's 24,000 km for a band wider than it is tall", () => {
    expect(globeAltitude({ width: 402, height: 200 })).toBe(24_000_000);
    expect(globeAltitude({ width: 600, height: 120 })).toBe(24_000_000);
  });

  it('goes higher when the view is taller than wide, so the Earth fits the width', () => {
    const square = globeAltitude({ width: 402, height: 402 });
    const tall = globeAltitude({ width: 402, height: 640 });
    expect(square).toBe(24_000_000);
    expect(tall).toBeGreaterThan(square);
    expect(tall).toBeGreaterThan(35_000_000);
    expect(tall).toBeLessThan(45_000_000);
  });

  it('falls back to the band altitude before the view is measured', () => {
    expect(globeAltitude({ width: 0, height: 0 })).toBe(24_000_000);
  });
});
