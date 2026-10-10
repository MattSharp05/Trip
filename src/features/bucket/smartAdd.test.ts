import { tripDays } from '@/core/dates';
import { toMinutes } from '@/core/reflow';
import { windowMinutes } from '@/core/smartAdd';
import { distanceKm, DETOUR } from '@/core/travel';
import { vegasSnapshot } from '@/scenarios/fixtures/vegas';
import type { TripData } from '@/services/data/types';

import { applyChange, NO_SLOT_MESSAGE, planBucketSmartAdd, smartAddResult } from './smartAdd';

const trip = vegasSnapshot.trips.find((t) => t.id === vegasSnapshot.bucketItems[0].tripId)!;
const vegas: TripData = {
  trip,
  places: vegasSnapshot.places,
  items: vegasSnapshot.items.filter((i) => i.tripId === trip.id),
  bookings: [],
  bucketItems: vegasSnapshot.bucketItems,
  expenses: [],
};
const bucket = (id: string) => vegas.bucketItems.find((b) => b.id === id)!;
const placeAt = (id: string) => {
  const p = vegas.places.find((place) => place.id === id)!;
  return { lat: p.lat!, lng: p.lng! };
};

describe('Smart Add on the Vegas trip', () => {
  it('puts Golden Tiki inside its 4 PM–2 AM window, adding less travel than the emptiest day', () => {
    const tiki = bucket('bucket-golden-tiki');
    const result = smartAddResult(vegas, tiki);
    if (result.kind !== 'placed') throw new Error(result.kind);
    const { day, startTime, durationMinutes, addedKm } = result.placement;

    const window = windowMinutes(tiki.windowStart, tiki.windowEnd);
    const start = toMinutes(startTime);
    expect(start).toBeGreaterThanOrEqual(window.from);
    expect(start + durationMinutes).toBeLessThanOrEqual(window.to);
    expect({ day, startTime }).toEqual({ day: '2026-11-15', startTime: '16:00' });

    // Appending to the emptiest day (fewest items, earliest first): from its last stop.
    const days = tripDays(trip.startDate, trip.endDate);
    const count = (d: string) => vegas.items.filter((i) => i.day === d).length;
    const emptiest = days.reduce((a, b) => (count(b) < count(a) ? b : a));
    const last = vegas.items
      .filter((i) => i.day === emptiest)
      .sort((a, b) => a.startTime!.localeCompare(b.startTime!))
      .at(-1)!;
    const appendKm = distanceKm(placeAt(last.placeId!), placeAt(tiki.placeId)) * DETOUR;
    expect(addedKm).toBeLessThan(appendKm);
  });

  it('turns a placement into writes, a toast, and an Undo that restores the trip exactly', () => {
    // Fred again.. (Sat 14, 8–11 PM) now overlaps a flexible stop moved to 9 PM that night.
    const data: TripData = {
      ...vegas,
      items: vegas.items.map((i) => (i.id === 'item-10' ? { ...i, startTime: '21:00' } : i)),
    };
    const plan = planBucketSmartAdd(data, bucket('bucket-fred-again'), 'new-item');
    if (!('change' in plan)) throw new Error(plan.message);

    expect(plan.message).toBe(
      'Added to Sat 14, 8:00 PM · 9 min drive from The Forum Shops · moved The Forum Shops to Sat 14, 6:15 PM',
    );
    expect(plan).toMatchObject({ itemId: 'new-item', day: '2026-11-14' });
    const [added, moved] = plan.change.save;
    expect(added).toMatchObject({
      id: 'new-item',
      day: '2026-11-14',
      startTime: '20:00',
      durationMinutes: 180,
      placeId: 'place-xs',
      kind: 'event',
      fixed: true,
      title: 'Fred again..',
    });
    expect(moved).toMatchObject({ id: 'item-10', day: '2026-11-14', startTime: '18:15' });
    expect(plan.change.removeBucket).toEqual(['bucket-fred-again']);

    const after = applyChange(data, plan.change);
    expect(after.bucketItems.map((b) => b.id)).not.toContain('bucket-fred-again');
    const restored = applyChange(after, plan.undo);
    const byId = <T extends { id: string }>(xs: T[]) =>
      [...xs].sort((a, b) => a.id.localeCompare(b.id));
    expect(byId(restored.items)).toEqual(byId(data.items));
    expect(byId(restored.bucketItems)).toEqual(byId(data.bucketItems));
  });

  it('keeps who saved the Bucket List item as the new stop’s adder', () => {
    const blakes = { ...bucket('bucket-golden-tiki'), addedBy: 'user-blake' };
    const plan = planBucketSmartAdd(vegas, blakes, 'new-item');
    if (!('change' in plan)) throw new Error(plan.message);
    expect(plan.change.save[0]).toMatchObject({ id: 'new-item', addedBy: 'user-blake' });
    const mine = planBucketSmartAdd(vegas, bucket('bucket-golden-tiki'), 'new-item');
    if (!('change' in mine)) throw new Error(mine.message);
    expect(mine.change.save[0]).not.toHaveProperty('addedBy');
  });

  it('gives a flexible place its kind and no fixed time', () => {
    const plan = planBucketSmartAdd(vegas, bucket('bucket-lotus-of-siam'), 'x');
    if (!('change' in plan)) throw new Error(plan.message);
    expect(plan.change.save[0]).toMatchObject({ kind: 'food', fixed: false, startTime: '15:45' });
    expect(plan.change.save[0]).not.toHaveProperty('title');
  });

  it('explains a clash with a booking, or a trip with no room', () => {
    const ufc = { ...bucket('bucket-fred-again'), fixedDate: '2026-11-15', fixedTime: '19:00' };
    expect(planBucketSmartAdd(vegas, ufc)).toEqual({ message: 'Overlaps UFC 310 at 6:00 PM.' });

    const full: TripData = {
      ...vegas,
      items: tripDays(trip.startDate, trip.endDate).map((day, i) => ({
        ...vegas.items[0],
        id: `busy-${i}`,
        day,
        startTime: '09:00',
        durationMinutes: 15 * 60,
        kind: 'activity',
        bookingId: null,
        fixed: true,
      })),
    };
    expect(planBucketSmartAdd(full, bucket('bucket-pinball'))).toEqual({
      message: NO_SLOT_MESSAGE,
    });
  });
});
