import { fixedOverlap, fromMinutes, reorder, toMinutes, type ReflowItem } from './reflow';

const item = (
  id: string,
  startTime: string | null,
  durationMinutes: number | null,
  fixed = false,
): ReflowItem => ({ id, startTime, durationMinutes, fixed });

/** Vegas, Fri Nov 13 (the `vegas-plan-day-2` scenario). */
const friday = [
  item('brunch', '10:00', 75),
  item('fountains', '12:00', 60),
  item('sphere', '15:00', 90, true),
  item('carbone', '20:00', 105, true),
];

describe('minutes', () => {
  it('converts both ways', () => {
    expect(toMinutes('15:05')).toBe(905);
    expect(fromMinutes(905)).toBe('15:05');
    expect(fromMinutes(0)).toBe('00:00');
  });
});

describe('reorder', () => {
  it('swaps two flexible items and their times', () => {
    expect(reorder(friday, 0, 1)).toEqual({
      ok: true,
      times: { fountains: '10:00', brunch: '12:00' },
    });
    expect(reorder(friday, 1, 0)).toEqual({
      ok: true,
      times: { fountains: '10:00', brunch: '12:00' },
    });
  });

  it('pushes the next item later when the first runs into its slot', () => {
    const day = [item('a', '10:00', 60), item('b', '11:00', 150), item('c', '13:00', 60)];
    // b (2.5 h) first: 10:00–12:30, so a can't start at 11:00 and c moves on from a.
    expect(reorder(day, 1, 0)).toEqual({
      ok: true,
      times: { b: '10:00', a: '12:30', c: '13:30' },
    });
  });

  it('only touches later items that the change runs into', () => {
    const day = [item('a', '09:00', 30), item('b', '09:30', 30), item('c', '18:00', 60)];
    expect(reorder(day, 0, 1)).toEqual({ ok: true, times: { b: '09:00', a: '09:30' } });
  });

  it('moves a later item to the front, rotating the slots', () => {
    const day = [item('a', '10:00', 60), item('b', '11:00', 60), item('c', '13:00', 60)];
    expect(reorder(day, 2, 0)).toEqual({
      ok: true,
      times: { c: '10:00', a: '11:00', b: '13:00' },
    });
  });

  it('keeps fixed items in place when flexible items swap around them', () => {
    const day = [item('a', '10:00', 60), item('f', '12:00', 60, true), item('b', '15:00', 60)];
    expect(reorder(day, 2, 0)).toEqual({ ok: true, times: { b: '10:00', a: '15:00' } });
  });

  it('refuses dropping onto a fixed item', () => {
    expect(reorder(friday, 1, 2)).toEqual({ ok: false, reason: 'overlap', id: 'sphere' });
    expect(reorder(friday, 0, 3)).toEqual({ ok: false, reason: 'overlap', id: 'carbone' });
  });

  it('refuses a swap that would run into a fixed item', () => {
    const day = [item('a', '10:00', 60), item('f', '12:00', 60, true), item('b', '15:00', 150)];
    expect(reorder(day, 2, 0)).toEqual({ ok: false, reason: 'overlap', id: 'f' });
  });

  it('refuses picking up a fixed item', () => {
    expect(reorder(friday, 2, 0)).toEqual({ ok: false, reason: 'fixed', id: 'sphere' });
  });

  it('does nothing when dropped where it was', () => {
    expect(reorder(friday, 1, 1)).toEqual({ ok: true, times: {} });
  });

  it('gives an untimed item the time after the one before it', () => {
    const day = [item('a', '10:00', 60), item('b', '11:00', 30), item('n', null, null)];
    // n dropped onto b: n takes b's slot, b follows on after n's (default) hour.
    expect(reorder(day, 2, 1)).toEqual({ ok: true, times: { n: '11:00', b: '12:00' } });
  });

  it('refuses times past midnight', () => {
    const day = [item('a', '22:00', 60), item('b', '23:00', 150)];
    expect(reorder(day, 0, 1)).toEqual({ ok: false, reason: 'late' });
  });
});

describe('fixedOverlap', () => {
  it('finds the fixed item a time would run into', () => {
    expect(fixedOverlap(friday, 'fountains', '14:30', 60)?.id).toBe('sphere');
    expect(fixedOverlap(friday, 'fountains', '13:00', 120)).toBeNull();
    expect(fixedOverlap(friday, 'fountains', '16:30', null)).toBeNull();
  });

  it('ignores the item itself and flexible items', () => {
    expect(fixedOverlap(friday, 'sphere', '15:00', 90)).toBeNull();
    expect(fixedOverlap(friday, 'x', '10:30', 60)).toBeNull();
  });
});
