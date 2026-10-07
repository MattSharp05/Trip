import { toMinutes } from '@/core/reflow';
import { windowMinutes } from '@/core/smartAdd';
import { vegasSnapshot } from '@/scenarios/fixtures/vegas';
import type { TripData } from '@/services/data/types';

import { NO_ROOM_NOTE, planBucketAll } from './planAll';
import { applyChange } from './smartAdd';

const trip = vegasSnapshot.trips.find((t) => t.id === vegasSnapshot.bucketItems[0].tripId)!;
const vegas: TripData = {
  trip,
  places: vegasSnapshot.places,
  items: vegasSnapshot.items.filter((i) => i.tripId === trip.id),
  bookings: [],
  bucketItems: vegasSnapshot.bucketItems,
  expenses: [],
};

const counter = () => {
  let n = 0;
  return () => `new-${(n += 1)}`;
};

function expectNoOverlaps(data: TripData) {
  for (const day of new Set(data.items.map((i) => i.day))) {
    const line = data.items
      .filter((i) => i.day === day && i.startTime)
      .map((i) => ({
        id: i.id,
        start: toMinutes(i.startTime!),
        end: toMinutes(i.startTime!) + (i.durationMinutes ?? 60),
      }))
      .sort((a, b) => a.start - b.start);
    for (let k = 1; k < line.length; k += 1) {
      expect({ day, id: line[k].id, start: line[k].start }).toEqual({
        day,
        id: line[k].id,
        start: Math.max(line[k].start, line[k - 1].end),
      });
    }
  }
}

describe('Plan my bucket list on vegas-bucket', () => {
  it('places every saved item, inside its window or at its fixed time, with no overlaps', () => {
    const plan = planBucketAll(vegas, counter());
    if (!plan.change) throw new Error(plan.message);

    expect(plan.notes).toEqual({});
    const after = applyChange(vegas, plan.change);
    expect(after.bucketItems).toEqual([]);
    expect(after.items).toHaveLength(vegas.items.length + vegas.bucketItems.length);
    expectNoOverlaps(after);

    for (const bucketItem of vegas.bucketItems) {
      const stop = plan.change.save.find(
        (i) => i.placeId === bucketItem.placeId && i.id.startsWith('new-'),
      )!;
      expect(stop.durationMinutes).toBe(bucketItem.durationMinutes);
      if (bucketItem.fixedDate) {
        expect(stop).toMatchObject({
          day: bucketItem.fixedDate,
          startTime: bucketItem.fixedTime,
          kind: 'event',
          fixed: true,
          title: 'Fred again..',
        });
      } else {
        const window = windowMinutes(bucketItem.windowStart, bucketItem.windowEnd);
        const start = toMinutes(stop.startTime!);
        expect(start).toBeGreaterThanOrEqual(window.from);
        expect(start + stop.durationMinutes!).toBeLessThanOrEqual(window.to);
      }
    }
    expect(plan.message.split('\n')[0]).toBe('Placed 5 items across your trip');
  });

  it('Undo puts the trip back exactly, in one step', () => {
    const plan = planBucketAll(vegas, counter());
    const after = applyChange(vegas, plan.change!);
    const undone = applyChange(after, plan.undo!);

    const byId = <T extends { id: string }>(list: T[]) =>
      [...list].sort((a, b) => a.id.localeCompare(b.id));
    expect(byId(undone.items)).toEqual(byId(vegas.items));
    expect(byId(undone.bucketItems)).toEqual(byId(vegas.bucketItems));
  });

  it('opens on the earliest new stop', () => {
    const plan = planBucketAll(vegas, counter());
    const added = plan.change!.save.filter((i) => i.id.startsWith('new-'));
    const earliest = [...added].sort(
      (a, b) => a.day.localeCompare(b.day) || a.startTime!.localeCompare(b.startTime!),
    )[0];
    expect(plan.first).toEqual({ itemId: earliest.id, day: earliest.day });
  });

  it('keeps what does not fit in the list with a note, and places the rest', () => {
    // Every day is full from 9 AM to 12:30 AM except Sat 14 evening: only Fred again.. (8 PM) fits.
    const busy: TripData = {
      ...vegas,
      items: ['2026-11-12', '2026-11-13', '2026-11-15', '2026-11-16']
        .map((day) => ({
          id: `busy-${day}`,
          tripId: trip.id,
          day,
          startTime: '09:00',
          durationMinutes: 15 * 60 + 30,
          placeId: null,
          kind: 'activity' as const,
          bookingId: null,
          fixed: true,
        }))
        .concat({
          id: 'busy-sat',
          tripId: trip.id,
          day: '2026-11-14',
          startTime: '09:00',
          durationMinutes: 11 * 60,
          placeId: null,
          kind: 'activity' as const,
          bookingId: null,
          fixed: true,
        }),
    };
    const plan = planBucketAll(busy, counter());

    expect(plan.change?.removeBucket).toEqual(['bucket-fred-again']);
    expect(Object.keys(plan.notes).sort()).toEqual([
      'bucket-fremont',
      'bucket-golden-tiki',
      'bucket-lotus-of-siam',
      'bucket-pinball',
    ]);
    expect(new Set(Object.values(plan.notes))).toEqual(new Set([NO_ROOM_NOTE]));
    expect(plan.message).toBe("Placed 1 item across your trip\nSat 14 · 4 didn't fit");
  });

  it('says so when nothing fits, with no change to undo', () => {
    const plan = planBucketAll({
      ...vegas,
      bucketItems: [{ ...vegas.bucketItems[4], fixedDate: '2026-12-01' }],
    });
    expect(plan.change).toBeNull();
    expect(plan.undo).toBeNull();
    expect(plan.notes).toEqual({ 'bucket-fred-again': 'Not during this trip' });
  });
});
