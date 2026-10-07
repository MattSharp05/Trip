import {
  DAY_LOAD_KM,
  planSmartAdd,
  windowMinutes,
  type PlannerItem,
  type SmartAddCandidate,
  type SmartAddInput,
} from './smartAdd';
import type { LatLng, TravelEstimate } from './travel';

// A flat test world: lat/lng are km on a grid; travel takes 2 minutes per km, at least 1.
const travel = (a: LatLng, b: LatLng): TravelEstimate => {
  const km = Math.abs(a.lat - b.lat) + Math.abs(a.lng - b.lng);
  return { mode: 'walk', minutes: Math.max(1, Math.round(km * 2)), distanceKm: km };
};
const at = (lat: number, lng = 0): LatLng => ({ lat, lng });

const DAYS = ['2026-11-12', '2026-11-13', '2026-11-14'];

const item = (
  id: string,
  day: string,
  startTime: string | null,
  durationMinutes: number,
  position: LatLng | null,
  extra: Partial<PlannerItem> = {},
): PlannerItem => ({
  id,
  day,
  startTime,
  durationMinutes,
  fixed: false,
  position,
  kind: 'activity',
  ...extra,
});

const candidate = (extra: Partial<SmartAddCandidate> = {}): SmartAddCandidate => ({
  position: at(0),
  durationMinutes: 60,
  kind: null,
  windowStart: null,
  windowEnd: null,
  fixedDate: null,
  fixedTime: null,
  ...extra,
});

const plan = (items: PlannerItem[], c: Partial<SmartAddCandidate>, days = DAYS) =>
  planSmartAdd({ days, items, candidate: candidate(c), travel } satisfies SmartAddInput);

describe('Smart Add: flexible places', () => {
  it('fits a gap between two stops, after the first one plus travel, on the quarter hour', () => {
    const items = [
      item('a', DAYS[0], '10:00', 60, at(0)),
      item('b', DAYS[0], '14:00', 60, at(10)),
      // The other days are busy with far-away stops.
      item('c', DAYS[1], '09:00', 900, at(100)),
      item('d', DAYS[2], '09:00', 900, at(100)),
    ];
    const result = plan(items, { position: at(5) });
    expect(result).toMatchObject({
      kind: 'placed',
      // 11:00 end + 10 min travel → 11:10 → 11:15.
      placement: { day: DAYS[0], startTime: '11:15', durationMinutes: 60, addedKm: 0 },
      moved: [],
    });
    if (result.kind === 'placed') expect(result.placement.previous?.id).toBe('a');
  });

  it('skips a gap too short for the visit plus travel to the next stop', () => {
    const items = [
      item('a', DAYS[0], '10:00', 60, at(0)),
      // 11:00 + 60 min visit + 10 min travel > 12:00: no room before b.
      item('b', DAYS[0], '12:00', 60, at(10)),
    ];
    const result = plan(items, { position: at(5), windowStart: '09:00', windowEnd: '23:00' }, [
      DAYS[0],
    ]);
    expect(result).toMatchObject({ kind: 'placed', placement: { startTime: '13:15' } });
  });

  it('starts no earlier than its opening window', () => {
    const result = plan([], { windowStart: '17:00', windowEnd: '22:00' }, [DAYS[0]]);
    expect(result).toMatchObject({ kind: 'placed', placement: { startTime: '17:00' } });
  });

  it('ends inside its window, and never before 9:00', () => {
    // The only free time before the window closes at 12:00 is 8:00–9:00, before the day starts.
    const items = [item('a', DAYS[0], '09:00', 180, at(0))];
    expect(plan(items, { windowStart: '07:00', windowEnd: '12:00' }, [DAYS[0]])).toEqual({
      kind: 'none',
      reason: 'no-slot',
    });
  });

  it('places a bar whose window runs past midnight late at night', () => {
    // Busy until 22:00; 4 PM–2 AM still has room after it.
    const items = [item('a', DAYS[0], '09:00', 13 * 60, at(0))];
    const result = plan(items, { windowStart: '16:00', windowEnd: '02:00', durationMinutes: 90 }, [
      DAYS[0],
    ]);
    expect(result).toMatchObject({ kind: 'placed', placement: { startTime: '22:15' } });
    // Three hours from 22:15 would end after the 24:30 cap.
    expect(
      plan(items, { windowStart: '16:00', windowEnd: '02:00', durationMinutes: 180 }, [DAYS[0]]),
    ).toEqual({ kind: 'none', reason: 'no-slot' });
    expect(windowMinutes('16:00', '02:00')).toEqual({ from: 16 * 60, to: 24 * 60 + 30 });
  });

  it('never overlaps a fixed item', () => {
    const items = [
      item('show', DAYS[0], '10:00', 600, at(0), { fixed: true, kind: 'event' }),
      item('x', DAYS[1], '09:00', 900, at(0)),
    ];
    const result = plan(items, { durationMinutes: 120 }, DAYS.slice(0, 2));
    // 10:00–20:00 is the show; then 20:00 + 1 min travel → 20:15, ending 22:15 (window ends 22:00).
    expect(result).toEqual({ kind: 'none', reason: 'no-slot' });
    const later = plan(items, { durationMinutes: 90 }, DAYS.slice(0, 2));
    expect(later).toMatchObject({
      kind: 'placed',
      placement: { day: DAYS[0], startTime: '20:15' },
    });
  });

  it('prefers the day whose stops are nearby, even if it is busier', () => {
    const items = [
      item('near-1', DAYS[0], '10:00', 60, at(1)),
      item('near-2', DAYS[0], '15:00', 60, at(1)),
      item('far', DAYS[1], '10:00', 60, at(30)),
    ];
    const result = plan(items, { position: at(0) }, DAYS.slice(0, 2));
    expect(result).toMatchObject({ kind: 'placed', placement: { day: DAYS[0] } });
    if (result.kind === 'placed') expect(result.placement.addedKm).toBe(1);
  });

  it('breaks a tie in travel by the emptier day, then the earlier day and time', () => {
    const items = [item('a', DAYS[0], '10:00', 60, null)];
    // No positions: no travel anywhere, so only the day's load counts.
    expect(plan(items, { position: null })).toMatchObject({
      kind: 'placed',
      placement: { day: DAYS[1], startTime: '09:00' },
    });
    expect(DAY_LOAD_KM).toBe(0.5);
  });

  it('never goes before the arriving flight or after the departing one', () => {
    const items = [
      item('arrive', DAYS[0], '20:00', 30, at(0), { fixed: true, kind: 'flight' }),
      item('leave', DAYS[1], '10:00', 30, at(0), { fixed: true, kind: 'flight' }),
    ];
    const result = plan(items, {}, DAYS.slice(0, 2));
    // Before the 20:00 arrival and after the 10:00 departure are off the trip, and 9:00 on the last
    // day ends too close to the flight: 20:30 + 1 min travel → 20:45 on the first day.
    expect(result).toMatchObject({
      kind: 'placed',
      placement: { day: DAYS[0], startTime: '20:45' },
    });
  });

  it('says so when no day has room', () => {
    const items = DAYS.map((day, i) => item(`busy-${i}`, day, '09:00', 15 * 60, at(0)));
    expect(plan(items, {})).toEqual({ kind: 'none', reason: 'no-slot' });
  });

  it('uses the default window and a duration by kind when the item has none', () => {
    const result = plan([], { durationMinutes: null, kind: 'nightlife' }, [DAYS[0]]);
    expect(result).toMatchObject({
      kind: 'placed',
      placement: { startTime: '09:00', durationMinutes: 180 },
    });
  });

  it('gives the same answer every time, whatever order the items come in', () => {
    const items = [
      item('a', DAYS[0], '10:00', 60, at(3)),
      item('b', DAYS[1], '10:00', 60, at(3)),
      item('c', DAYS[2], '10:00', 60, at(3)),
    ];
    const first = plan(items, { position: at(0) });
    expect(plan([...items].reverse(), { position: at(0) })).toEqual(first);
    expect(first).toMatchObject({ placement: { day: DAYS[0], startTime: '11:15' } });
  });
});

describe('Smart Add: fixed-time events', () => {
  it('goes on its own date and time', () => {
    const items = [item('a', DAYS[1], '10:00', 60, at(2))];
    const result = plan(items, { fixedDate: DAYS[1], fixedTime: '20:00', durationMinutes: 180 });
    expect(result).toMatchObject({
      kind: 'placed',
      placement: { day: DAYS[1], startTime: '20:00', durationMinutes: 180, previous: { id: 'a' } },
      moved: [],
    });
  });

  it('moves a flexible item it overlaps to the nearest free time on the same day', () => {
    const items = [
      item('lunch', DAYS[1], '12:00', 60, at(1)),
      item('dinner', DAYS[1], '19:00', 90, at(1)),
    ];
    const result = plan(items, { fixedDate: DAYS[1], fixedTime: '18:30', durationMinutes: 120 });
    expect(result).toMatchObject({
      kind: 'placed',
      placement: { day: DAYS[1], startTime: '18:30' },
      moved: [
        {
          id: 'dinner',
          day: DAYS[1],
          startTime: '16:45',
          from: { day: DAYS[1], startTime: '19:00' },
        },
      ],
    });
  });

  it('moves a flexible item to another day when its own day is full', () => {
    const items = [
      item('morning', DAYS[1], '09:00', 9 * 60, at(0)),
      item('walk', DAYS[1], '18:00', 60, at(0)),
    ];
    const result = plan(items, { fixedDate: DAYS[1], fixedTime: '18:00', durationMinutes: 300 });
    expect(result).toMatchObject({
      kind: 'placed',
      moved: [{ id: 'walk', day: DAYS[0], startTime: '09:00' }],
    });
  });

  it('reports a conflict with a fixed item instead of moving it', () => {
    const items = [item('ufc', DAYS[1], '18:00', 210, at(0), { fixed: true, kind: 'event' })];
    const result = plan(items, { fixedDate: DAYS[1], fixedTime: '20:00', durationMinutes: 180 });
    expect(result).toMatchObject({
      kind: 'conflict',
      conflictId: 'ufc',
      placement: { day: DAYS[1], startTime: '20:00' },
    });
  });

  it('refuses an event outside the trip', () => {
    expect(plan([], { fixedDate: '2027-01-01', fixedTime: '20:00' })).toEqual({
      kind: 'none',
      reason: 'outside-trip',
    });
  });
});
