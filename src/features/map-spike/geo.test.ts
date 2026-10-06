import { along, bearing, greatCircle } from './geo';

const TPA = { lat: 27.9755, lng: -82.5332 };
const LAS = { lat: 36.084, lng: -115.1537 };

describe('greatCircle', () => {
  it('starts and ends at the airports', () => {
    const arc = greatCircle(TPA, LAS, 32);
    expect(arc).toHaveLength(33);
    expect(arc[0].lat).toBeCloseTo(TPA.lat, 6);
    expect(arc[0].lng).toBeCloseTo(TPA.lng, 6);
    expect(arc[32].lat).toBeCloseTo(LAS.lat, 6);
    expect(arc[32].lng).toBeCloseTo(LAS.lng, 6);
  });

  it('bows north of the straight line on the way west', () => {
    const mid = greatCircle(TPA, LAS, 2)[1];
    expect(mid.lat).toBeGreaterThan((TPA.lat + LAS.lat) / 2);
  });

  it('handles identical endpoints', () => {
    expect(greatCircle(TPA, TPA)).toEqual([TPA, TPA]);
  });
});

describe('bearing', () => {
  it('points west-north-west from Tampa to Las Vegas', () => {
    expect(bearing(TPA, LAS)).toBeGreaterThan(280);
    expect(bearing(TPA, LAS)).toBeLessThan(300);
  });

  it('is 0 due north and 90 due east', () => {
    expect(bearing({ lat: 0, lng: 0 }, { lat: 1, lng: 0 })).toBeCloseTo(0);
    expect(bearing({ lat: 0, lng: 0 }, { lat: 0, lng: 1 })).toBeCloseTo(90);
  });
});

describe('along', () => {
  const path = greatCircle(TPA, LAS, 10);

  it('returns the ends at 0 and 1', () => {
    expect(along(path, 0).at).toEqual(path[0]);
    expect(along(path, 1).at.lat).toBeCloseTo(LAS.lat, 6);
  });

  it('clamps out-of-range fractions', () => {
    expect(along(path, -1).at).toEqual(path[0]);
    expect(along(path, 2).at.lng).toBeCloseTo(LAS.lng, 6);
  });
});
