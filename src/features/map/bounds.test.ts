import { boundsOf, latLng, regionFor } from './bounds';

const BRUNCH = { lat: 36.1125, lng: -115.172 };
const SPHERE = { lat: 36.1207, lng: -115.1622 };
const CARBONE = { lat: 36.1073, lng: -115.1767 };

describe('boundsOf', () => {
  it('is null for no points', () => {
    expect(boundsOf([])).toBeNull();
  });

  it('boxes every point', () => {
    expect(boundsOf([BRUNCH, SPHERE, CARBONE])).toEqual({
      minLat: 36.1073,
      maxLat: 36.1207,
      minLng: -115.1767,
      maxLng: -115.1622,
    });
  });
});

describe('regionFor', () => {
  it('is null for no points', () => {
    expect(regionFor([])).toBeNull();
  });

  it('centres on the box and pads its span', () => {
    const r = regionFor([BRUNCH, SPHERE, CARBONE], { padding: 2, minDelta: 0 })!;
    expect(r.latitude).toBeCloseTo(36.114, 6);
    expect(r.longitude).toBeCloseTo(-115.16945, 6);
    expect(r.latitudeDelta).toBeCloseTo(0.0268, 6);
    expect(r.longitudeDelta).toBeCloseTo(0.029, 6);
  });

  it('contains every point', () => {
    const points = [BRUNCH, SPHERE, CARBONE];
    const r = regionFor(points)!;
    for (const p of points) {
      expect(Math.abs(p.lat - r.latitude)).toBeLessThan(r.latitudeDelta / 2);
      expect(Math.abs(p.lng - r.longitude)).toBeLessThan(r.longitudeDelta / 2);
    }
  });

  it('keeps a minimum span around a single pin', () => {
    expect(regionFor([SPHERE])).toEqual({
      latitude: SPHERE.lat,
      longitude: SPHERE.lng,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    });
  });

  it('never asks for more than the whole world', () => {
    const r = regionFor([
      { lat: -80, lng: -170 },
      { lat: 80, lng: 170 },
    ])!;
    expect(r.latitudeDelta).toBe(180);
    expect(r.longitudeDelta).toBe(360);
  });
});

it('latLng converts to react-native-maps coordinates', () => {
  expect(latLng(SPHERE)).toEqual({ latitude: 36.1207, longitude: -115.1622 });
});
