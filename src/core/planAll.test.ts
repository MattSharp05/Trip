import { byConstraint, planAll, type PlanAllCandidate } from './planAll';
import { toMinutes } from './reflow';
import type { PlannerItem, SmartAddCandidate } from './smartAdd';

const flexible = (
  id: string,
  windowStart: string | null,
  windowEnd: string | null,
  durationMinutes: number,
  position = { lat: 36.11, lng: -115.17 },
): PlanAllCandidate => ({
  id,
  candidate: {
    position,
    durationMinutes,
    kind: 'food',
    windowStart,
    windowEnd,
    fixedDate: null,
    fixedTime: null,
  },
});

const event = (id: string, fixedDate: string, fixedTime: string, durationMinutes = 120) => ({
  id,
  candidate: {
    position: { lat: 36.12, lng: -115.17 },
    durationMinutes,
    kind: 'arena',
    windowStart: null,
    windowEnd: null,
    fixedDate,
    fixedTime,
  } satisfies SmartAddCandidate,
});

const stop = (id: string, day: string, startTime: string, durationMinutes = 60, fixed = false) =>
  ({
    id,
    day,
    startTime,
    durationMinutes,
    fixed,
    position: { lat: 36.1, lng: -115.17 },
    kind: fixed ? 'event' : 'food',
  }) satisfies PlannerItem;

/** No two timed stops on a day overlap. */
function expectNoOverlaps(items: readonly PlannerItem[]) {
  const days = new Set(items.map((i) => i.day));
  for (const day of days) {
    const line = items
      .filter((i) => i.day === day && i.startTime)
      .map((i) => ({
        start: toMinutes(i.startTime!),
        end: toMinutes(i.startTime!) + (i.durationMinutes ?? 60),
      }))
      .sort((a, b) => a.start - b.start);
    for (let k = 1; k < line.length; k += 1) {
      expect(line[k].start).toBeGreaterThanOrEqual(line[k - 1].end);
    }
  }
}

describe('byConstraint', () => {
  it('puts fixed-time events first (earliest first), then the narrowest window, then the longest visit', () => {
    const list = [
      flexible('wide-short', '09:00', '22:00', 60),
      flexible('wide-long', '09:00', '22:00', 120),
      event('event-sat', '2026-11-14', '20:00'),
      flexible('narrow', '18:00', '21:00', 60),
      event('event-fri', '2026-11-13', '19:00'),
    ];
    expect([...list].sort(byConstraint).map((c) => c.id)).toEqual([
      'event-fri',
      'event-sat',
      'narrow',
      'wide-long',
      'wide-short',
    ]);
  });

  it('measures windows that run past midnight correctly and falls back to the id', () => {
    const lateBar = flexible('late-bar', '16:00', '02:00', 90); // 10 hours (capped at 00:30: 8.5)
    const lunch = flexible('lunch', '11:00', '15:00', 90); // 4 hours
    const twinA = flexible('a', '10:00', '12:00', 60);
    const twinB = flexible('b', '10:00', '12:00', 60);
    expect([lateBar, twinB, lunch, twinA].sort(byConstraint).map((c) => c.id)).toEqual([
      'a',
      'b',
      'lunch',
      'late-bar',
    ]);
  });
});

describe('planAll', () => {
  const days = ['2026-11-13', '2026-11-14'];

  it('places a whole set without overlaps, each against the plan updated so far', () => {
    const items = [
      stop('lunch', '2026-11-13', '12:00', 90),
      stop('show', '2026-11-14', '19:00', 120, true),
    ];
    const candidates = [
      flexible('dinner', '18:00', '22:00', 90),
      flexible('museum', '10:00', '17:00', 120),
      flexible('coffee', '09:00', '12:00', 30),
      flexible('bar', '20:00', '02:00', 90),
      event('concert', '2026-11-13', '21:00'),
    ];
    const result = planAll({ days, items, candidates });

    expect(result.skipped).toEqual([]);
    expect(result.placed.map((p) => p.id)).toEqual([
      'concert',
      'coffee',
      'dinner',
      'bar',
      'museum',
    ]);
    expect(result.items).toHaveLength(items.length + candidates.length);
    expectNoOverlaps(result.items);
    const concert = result.items.find((i) => i.id === 'concert')!;
    expect(concert).toMatchObject({ day: '2026-11-13', startTime: '21:00', fixed: true });
  });

  it('is deterministic: candidate order in the input does not matter', () => {
    const candidates = [
      flexible('a', '18:00', '22:00', 90),
      flexible('b', '10:00', '17:00', 120),
      event('c', '2026-11-14', '12:00'),
    ];
    const one = planAll({ days, items: [], candidates });
    const two = planAll({ days, items: [], candidates: [...candidates].reverse() });
    expect(two).toEqual(one);
  });

  it('leaves out what does not fit, says why, and still places the rest', () => {
    const items = [stop('ufc', '2026-11-13', '19:00', 240, true)];
    const candidates = [
      event('clash', '2026-11-13', '20:00'),
      event('later', '2026-11-20', '20:00'),
      flexible('tiny-window', '19:30', '20:30', 60),
      flexible('ok', '10:00', '17:00', 60),
    ];
    const result = planAll({ days: ['2026-11-13'], items, candidates });

    expect(result.placed.map((p) => p.id)).toEqual(['ok']);
    expect(result.skipped).toEqual([
      { id: 'clash', reason: 'conflict', conflictId: 'ufc' },
      { id: 'later', reason: 'outside-trip' },
      { id: 'tiny-window', reason: 'no-slot' },
    ]);
  });

  it('does not double-book two events at the same time: the second one is a conflict', () => {
    const result = planAll({
      days,
      items: [],
      candidates: [event('first', '2026-11-13', '20:00'), event('second', '2026-11-13', '21:00')],
    });
    expect(result.placed.map((p) => p.id)).toEqual(['first']);
    expect(result.skipped).toEqual([{ id: 'second', reason: 'conflict', conflictId: 'first' }]);
  });

  it("moves a flexible stop out of an event's way and reports the move", () => {
    const result = planAll({
      days,
      items: [stop('walk', '2026-11-13', '20:00', 60)],
      candidates: [event('show', '2026-11-13', '19:30', 120)],
    });
    expect(result.moved).toHaveLength(1);
    expect(result.moved[0]).toMatchObject({
      id: 'walk',
      from: { day: '2026-11-13', startTime: '20:00' },
    });
    expectNoOverlaps(result.items);
  });
});
