import { BLAKE, groupArrivalsSnapshot, WILLEM } from '@/scenarios/fixtures/group';
import { ME, vegasSnapshot } from '@/scenarios/fixtures/vegas';
import { createDemoSource } from '@/services/data/source';

import {
  along,
  bearing,
  convergingCamera,
  dayFlight,
  greatCircle,
  planeProgress,
  planeTiming,
  routeCamera,
  travelerLegs,
} from './flights';

const TPA = { lat: 27.9755, lng: -82.5332 };
const LAS = { lat: 36.084, lng: -115.1537 };
const JFK = { lat: 40.6413, lng: -73.7781 };
const LHR = { lat: 51.47, lng: -0.4543 };

describe('greatCircle', () => {
  it('starts and ends exactly at the two airports', () => {
    const arc = greatCircle(JFK, LHR, 10);
    expect(arc).toHaveLength(11);
    expect(arc[0].lat).toBeCloseTo(JFK.lat, 9);
    expect(arc[0].lng).toBeCloseTo(JFK.lng, 9);
    expect(arc[10].lat).toBeCloseTo(LHR.lat, 9);
    expect(arc[10].lng).toBeCloseTo(LHR.lng, 9);
  });

  it('puts the midpoint on the great circle, halfway in distance and north of the straight line', () => {
    const [, mid] = greatCircle(JFK, LHR, 2);
    // The known great-circle midpoint of JFK–LHR is over the Atlantic near 52.4° N, 41.3° W.
    expect(mid.lat).toBeCloseTo(52.4, 0);
    expect(mid.lng).toBeCloseTo(-41.3, 0);
    expect(mid.lat).toBeGreaterThan((JFK.lat + LHR.lat) / 2);
  });

  it('keeps every point between the airports in longitude on a westbound flight', () => {
    for (const p of greatCircle(TPA, LAS, 16)) {
      expect(p.lng).toBeLessThanOrEqual(TPA.lng + 1e-9);
      expect(p.lng).toBeGreaterThanOrEqual(LAS.lng - 1e-9);
    }
  });

  it('is the same arc in reverse for the flight home', () => {
    const out = greatCircle(TPA, LAS, 8);
    const home = greatCircle(LAS, TPA, 8).reverse();
    home.forEach((p, i) => {
      expect(p.lat).toBeCloseTo(out[i].lat, 9);
      expect(p.lng).toBeCloseTo(out[i].lng, 9);
    });
  });
});

describe('bearing', () => {
  it('heads west-north-west from Tampa and east-south-east from Las Vegas', () => {
    expect(bearing(TPA, LAS)).toBeGreaterThan(280);
    expect(bearing(TPA, LAS)).toBeLessThan(300);
    expect(bearing(LAS, TPA)).toBeGreaterThan(90);
    expect(bearing(LAS, TPA)).toBeLessThan(120);
  });

  it('steers the plane along the arc', () => {
    const arc = greatCircle(JFK, LHR, 2);
    expect(along(arc, 0).heading).toBeCloseTo(bearing(JFK, arc[1]));
  });
});

describe('dayFlight', () => {
  it('finds AA 2410, Tampa to Las Vegas, on Thursday', () => {
    const f = dayFlight(vegasSnapshot, '2026-11-12');
    expect(f).toMatchObject({
      itemId: 'item-01',
      bookingId: 'booking-flight-out',
      from: { code: 'TPA', city: 'Tampa', lat: TPA.lat, lng: TPA.lng },
      to: { code: 'LAS', city: 'Las Vegas', lat: LAS.lat, lng: LAS.lng },
    });
    expect(f?.flight.flightNumber).toBe('AA 2410');
  });

  it('finds AA 2411 home on Monday', () => {
    const f = dayFlight(vegasSnapshot, '2026-11-16');
    expect(f).toMatchObject({ itemId: 'item-15', from: { code: 'LAS' }, to: { code: 'TPA' } });
    expect(f?.flight.flightNumber).toBe('AA 2411');
  });

  it('is null on a day without a flight', () => {
    expect(dayFlight(vegasSnapshot, '2026-11-13')).toBeNull();
  });

  it('skips a flight whose airport has no place on the map', () => {
    const places = vegasSnapshot.places.filter((p) => p.id !== 'place-tpa');
    expect(dayFlight({ ...vegasSnapshot, places }, '2026-11-12')).toBeNull();
  });
});

describe('routeCamera', () => {
  it('looks down on the middle of the arc', () => {
    const { center } = routeCamera(TPA, LAS);
    const [, mid] = greatCircle(TPA, LAS, 2);
    expect(center).toEqual(mid);
  });

  it('flies higher for longer routes, within limits', () => {
    const short = routeCamera(TPA, LAS).altitude;
    const long = routeCamera(JFK, LHR).altitude;
    expect(long).toBeGreaterThan(short);
    expect(routeCamera(TPA, { lat: 28, lng: -82.6 }).altitude).toBe(4_000_000);
    expect(routeCamera(JFK, { lat: -33.9, lng: 151.2 }).altitude).toBe(24_000_000);
  });
});

describe('travelerLegs (TR-63)', () => {
  const trip = groupArrivalsSnapshot.trips.find((t) => t.id === 'trip-vegas')!;
  const { places } = groupArrivalsSnapshot;
  const flights = () => createDemoSource(groupArrivalsSnapshot).listTripFlights('trip-vegas');
  const code = (e: { code: string }) => e.code;

  it('gives three arcs into LAS on arrival day, in landing order', async () => {
    const legs = travelerLegs(await flights(), trip, places, '2026-11-12');
    expect(legs.map((l) => [l.travelerId, code(l.from), code(l.to), l.direction])).toEqual([
      [ME, 'TPA', 'LAS', 'arrival'],
      [BLAKE, 'ORD', 'LAS', 'arrival'],
      [WILLEM, 'JFK', 'LAS', 'arrival'],
    ]);
    expect(legs[1].from).toMatchObject({ lat: 41.9742, lng: -87.9073, city: 'Chicago' });
  });

  it('sends departures outward, from LAS', async () => {
    const legs = travelerLegs(await flights(), trip, places, '2026-11-16');
    expect(legs.map((l) => [l.travelerId, code(l.from), code(l.to), l.direction])).toEqual([
      [ME, 'LAS', 'TPA', 'departure'],
      [BLAKE, 'LAS', 'ORD', 'departure'],
      [WILLEM, 'LAS', 'JFK', 'departure'],
    ]);
  });

  it('is empty on a day nobody flies, and skips a leg whose airport is not on the map', async () => {
    expect(travelerLegs(await flights(), trip, places, '2026-11-14')).toEqual([]);
    // Blake's Chicago airport without coordinates (not a place anyone can see).
    const unplaced = (await flights()).map((f) =>
      f.from.code === 'ORD' ? { ...f, from: { code: 'ORD', city: 'Chicago', placeId: null } } : f,
    );
    const legs = travelerLegs(unplaced, trip, places, '2026-11-12');
    expect(legs.map((l) => l.travelerId)).toEqual([ME, WILLEM]);
  });

  it("places your own legs from the trip's places when the leg has no coordinates", async () => {
    const bare = (await flights()).map((f) => ({
      ...f,
      from: { code: f.from.code, city: f.from.city, placeId: f.from.placeId },
      to: { code: f.to.code, city: f.to.city, placeId: f.to.placeId },
    }));
    const legs = travelerLegs(bare, trip, places, '2026-11-12');
    expect(legs[0]).toMatchObject({ travelerId: ME, from: { code: 'TPA', lat: 27.9755 } });
  });
});

describe('convergingCamera (TR-63)', () => {
  const ORD = { lat: 41.9742, lng: -87.9073 };
  const ends = [TPA, ORD, JFK, LAS];

  it('frames every origin and the destination', () => {
    const { center, altitude, radius } = convergingCamera(ends);
    const r = (d: number) => (d * Math.PI) / 180;
    for (const p of ends) {
      // The angle between the centre and the airport (spherical law of cosines).
      const angle = Math.acos(
        Math.sin(r(center.lat)) * Math.sin(r(p.lat)) +
          Math.cos(r(center.lat)) * Math.cos(r(p.lat)) * Math.cos(r(p.lng - center.lng)),
      );
      expect(angle).toBeLessThanOrEqual(radius + 1e-9);
    }
    // The centre sits between the coasts, and the camera is high enough for the widest pair.
    expect(center.lng).toBeLessThan(TPA.lng);
    expect(center.lng).toBeGreaterThan(LAS.lng);
    expect(altitude).toBeGreaterThanOrEqual(routeCamera(JFK, LAS).altitude);
  });

  it('frames two airports like routeCamera', () => {
    const two = convergingCamera([TPA, LAS]);
    const route = routeCamera(TPA, LAS);
    expect(two.center.lat).toBeCloseTo(route.center.lat, 9);
    expect(two.center.lng).toBeCloseTo(route.center.lng, 9);
    expect(Math.abs(two.altitude - route.altitude)).toBeLessThanOrEqual(1);
  });
});

describe('planeProgress', () => {
  it('flies the arc, waits at the gate, then starts again', () => {
    expect(planeProgress(0, false)).toBe(0);
    expect(planeProgress(planeTiming.flightMs / 2, false)).toBeCloseTo(0.5);
    expect(planeProgress(planeTiming.flightMs + 100, false)).toBe(1);
    expect(planeProgress(planeTiming.loopMs + 70, false)).toBeCloseTo(70 / planeTiming.flightMs);
  });

  it('stays at the midpoint with Reduce Motion', () => {
    expect(planeProgress(0, true)).toBe(0.5);
    expect(planeProgress(3456, true)).toBe(0.5);
  });
});
