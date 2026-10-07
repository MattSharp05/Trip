import {
  distanceKm,
  distanceLabel,
  durationLabel,
  gapMinutes,
  isTight,
  travelEstimate,
  travelLabel,
} from './travel';

// Las Vegas Strip fixtures (src/scenarios/fixtures/vegas.ts).
const monAmiGabi = { lat: 36.1125, lng: -115.172 };
const bellagio = { lat: 36.1126, lng: -115.1741 };
const sphere = { lat: 36.1207, lng: -115.1622 };
const carbone = { lat: 36.1073, lng: -115.1767 };

describe('distanceKm', () => {
  it('is zero for the same point and symmetric', () => {
    expect(distanceKm(sphere, sphere)).toBe(0);
    expect(distanceKm(sphere, carbone)).toBeCloseTo(distanceKm(carbone, sphere), 10);
  });

  it('matches known great-circle distances', () => {
    // One degree of latitude is about 111.2 km.
    expect(distanceKm({ lat: 0, lng: 0 }, { lat: 1, lng: 0 })).toBeCloseTo(111.19, 1);
    // London to Paris: about 344 km.
    expect(distanceKm({ lat: 51.5074, lng: -0.1278 }, { lat: 48.8566, lng: 2.3522 })).toBeCloseTo(
      343.6,
      0,
    );
    // Across the Strip, Mon Ami Gabi to the Bellagio fountains: under 200 m.
    expect(distanceKm(monAmiGabi, bellagio)).toBeCloseTo(0.189, 2);
  });
});

describe('travelEstimate', () => {
  it('walks short legs at 4.8 km/h over the detoured distance', () => {
    expect(travelEstimate(monAmiGabi, bellagio)).toEqual({
      mode: 'walk',
      minutes: 3,
      distanceKm: expect.closeTo(0.246, 2),
    });
  });

  it('switches to driving once the detoured route passes 1.6 km', () => {
    // 1.2 km straight line → 1.56 km route: still a walk (20 min).
    const north = (km: number) => ({ lat: km / 111.19, lng: 0 });
    expect(travelEstimate(north(0), north(1.2))).toMatchObject({ mode: 'walk', minutes: 20 });
    // 1.25 km → 1.625 km route: a drive at 30 km/h plus 5 min (3.25 + 5 → 8 min).
    expect(travelEstimate(north(0), north(1.25))).toMatchObject({ mode: 'drive', minutes: 8 });
    // Bellagio to the Sphere: 1.4 km apart, 1.8 km of street.
    expect(travelEstimate(bellagio, sphere)).toMatchObject({ mode: 'drive', minutes: 9 });
  });

  it('rounds to the nearest minute and never says 0 min', () => {
    expect(travelEstimate(sphere, sphere)).toEqual({ mode: 'walk', minutes: 1, distanceKm: 0 });
    const north = (km: number) => ({ lat: km / 111.19, lng: 0 });
    // 0.1 km → 0.13 km route → 1.6 min → 2 min; 0.08 km → 1.3 min → 1 min.
    expect(travelEstimate(north(0), north(0.1)).minutes).toBe(2);
    expect(travelEstimate(north(0), north(0.08)).minutes).toBe(1);
  });
});

describe('gapMinutes and isTight', () => {
  it('counts free minutes from the end of one stop to the start of the next', () => {
    expect(gapMinutes('10:00', 75, '12:00')).toBe(45);
    expect(gapMinutes('12:00', 60, '13:05')).toBe(5);
    expect(gapMinutes('12:00', 90, '13:00')).toBe(-30);
  });

  it('is tight only when the trip takes longer than the gap', () => {
    const drive = { mode: 'drive' as const, minutes: 9, distanceKm: 1.8 };
    expect(isTight(drive, 5)).toBe(true);
    expect(isTight(drive, 9)).toBe(false);
    expect(isTight(drive, -10)).toBe(true);
  });
});

describe('labels', () => {
  it('writes durations in minutes and hours', () => {
    expect(durationLabel(6)).toBe('6 min');
    expect(durationLabel(60)).toBe('1 hr');
    expect(durationLabel(85)).toBe('1 hr 25 min');
  });

  it('writes distances in the preferred unit', () => {
    expect(distanceLabel(0.246, 'km')).toBe('0.2 km');
    expect(distanceLabel(0.246, 'miles')).toBe('0.2 mi');
    expect(distanceLabel(16.0934, 'miles')).toBe('10 mi');
    expect(distanceLabel(3.2, 'miles')).toBe('2 mi');
    expect(distanceLabel(12.34, 'km')).toBe('12 km');
  });

  it('names the mode', () => {
    expect(travelLabel({ mode: 'walk', minutes: 6, distanceKm: 0.5 })).toBe('6 min walk');
    expect(travelLabel({ mode: 'drive', minutes: 65, distanceKm: 30 })).toBe('1 hr 5 min drive');
  });
});
