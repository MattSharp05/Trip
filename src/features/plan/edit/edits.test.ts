import { vegasSnapshot } from '@/scenarios/fixtures/vegas';
import type { TripData } from '@/services/data/types';

import { applyEdit, kindForPlace, planReorder, planUpdate, suggestedStart } from './edits';

const FRIDAY = '2026-11-13';
const trip = vegasSnapshot.trips.find((t) => t.id === 'trip-vegas')!;
const data: TripData = {
  trip,
  places: vegasSnapshot.places,
  items: vegasSnapshot.items.filter((i) => i.tripId === trip.id),
  bookings: vegasSnapshot.bookings,
  bucketItems: [],
  expenses: [],
};
const byId = (id: string) => data.items.find((i) => i.id === id)!;

describe('itinerary edits', () => {
  it('plans a swap as new start times for both stops', () => {
    const plan = planReorder(data, FRIDAY, 0, 1);
    expect('edit' in plan && plan.edit.save.map((i) => [i.id, i.startTime])).toEqual([
      ['item-05', '12:00'],
      ['item-06', '10:00'],
    ]);
  });

  it('says which fixed stop a drop would overlap', () => {
    expect(planReorder(data, FRIDAY, 1, 2)).toEqual({
      message: 'Overlaps Sphere Experience at 3:00 PM.',
    });
  });

  it("refuses changing a booking's time or day", () => {
    const ufc = byId('item-12');
    expect(planUpdate(data, { ...ufc, startTime: '19:00' })).toEqual({
      message: 'UFC 310 gets its time from the booking.',
    });
    // Its notes are fine.
    expect(planUpdate(data, { ...ufc, notes: 'Gate 4' })).toHaveProperty('edit');
  });

  it('applies an edit to the cached trip', () => {
    const next = applyEdit(data, {
      save: [{ ...byId('item-06'), startTime: '09:00' }],
      remove: ['item-05'],
    });
    expect(next.items.find((i) => i.id === 'item-06')?.startTime).toBe('09:00');
    expect(next.items.some((i) => i.id === 'item-05')).toBe(false);
    expect(next.items).toHaveLength(data.items.length - 1);
  });

  it('suggests the next quarter hour after the last stop', () => {
    // Carbone: 8:00 PM for 1 hr 45 min.
    expect(suggestedStart(data, FRIDAY)).toBe('21:45');
    expect(suggestedStart(data, '2026-11-20')).toBe('10:00');
  });

  it('maps a searched place to an item kind', () => {
    expect(kindForPlace('food')).toBe('food');
    expect(kindForPlace('bar')).toBe('activity');
    expect(kindForPlace(null)).toBe('activity');
  });
});
