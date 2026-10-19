import { itineraryEntries } from '@/features/plan/itinerary';
import { BLAKE, groupSnapshot, WILLEM } from '@/scenarios/fixtures/group';
import type { Member, TripData } from '@/services/data/types';

import { planBucketAll } from './planAll';
import { applyChange } from './smartAdd';
import { bucketSuggestions, hasLikedItems, planSuggestions } from './suggest';

const trip = groupSnapshot.trips.find((t) => t.id === groupSnapshot.bucketItems[0].tripId)!;
const group: TripData = {
  trip,
  places: groupSnapshot.places,
  items: groupSnapshot.items.filter((i) => i.tripId === trip.id),
  bookings: [],
  bucketItems: groupSnapshot.bucketItems.filter((b) => b.tripId === trip.id),
  expenses: [],
};
const member = (id: string, name: string, isMe = false): Member => ({
  id,
  name,
  initial: name[0],
  role: isMe ? 'owner' : 'member',
  isMe,
});
const members = [
  member(groupSnapshot.me, 'Matthew', true),
  member(BLAKE, 'Blake'),
  member(WILLEM, 'Willem'),
];

describe('Suggest times for liked items on the group trip (TR-64)', () => {
  it('suggests Golden Tiki (2 likes) then Lotus of Siam (1), and nothing nobody liked', () => {
    const rows = bucketSuggestions(group);
    expect(rows.map((r) => [r.title, r.likes])).toEqual([
      ['Golden Tiki', 2],
      ['Lotus of Siam', 1],
    ]);
    expect(rows.every((r) => r.suggestion)).toBe(true);
    expect(rows[0].subtitle).toMatch(/^\w{3} \d+, \d+:\d{2} [AP]M · 2 likes$/);
    expect(hasLikedItems(group)).toBe(true);
    expect(hasLikedItems({ bucketItems: group.bucketItems.map(({ likedBy: _, ...b }) => b) })).toBe(
      false,
    );
  });

  it('plans the rest without a skipped item', () => {
    expect(bucketSuggestions(group, new Set(['bucket-golden-tiki'])).map((r) => r.title)).toEqual([
      'Lotus of Siam',
    ]);
  });

  it("accepting Blake's Golden Tiki makes a stop added by Blake, shown on Matthew's row", () => {
    const tiki = bucketSuggestions(group)[0].suggestion!;
    const plan = planSuggestions(group, [tiki], () => 'new-stop')!;
    const [stop] = plan.change.save;
    expect(stop).toMatchObject({
      id: 'new-stop',
      addedBy: BLAKE,
      day: tiki.placement.day,
      startTime: tiki.placement.startTime,
    });
    expect(plan.change.removeBucket).toEqual(['bucket-golden-tiki']);
    expect(plan.message).toMatch(/^Added Golden Tiki to /);

    const after = applyChange(group, plan.change);
    const row = itineraryEntries(after, stop.day, members).find((e) => e.id === 'new-stop')!;
    expect(row.addedBy).toBe('Blake');
    // Undo puts it back.
    const undone = applyChange(after, plan.undo);
    expect(undone.items.some((i) => i.id === 'new-stop')).toBe(false);
    expect(undone.bucketItems.some((b) => b.id === 'bucket-golden-tiki')).toBe(true);
  });

  it('Accept all places every suggestion where it was suggested, with one Undo', () => {
    const rows = bucketSuggestions(group);
    let n = 0;
    const plan = planSuggestions(
      group,
      rows.map((r) => r.suggestion!),
      () => `s${++n}`,
    )!;
    expect(plan.change.save.map((s) => [s.day, s.startTime])).toEqual(
      rows.map((r) => [r.suggestion!.placement.day, r.suggestion!.placement.startTime]),
    );
    expect(plan.undo.remove).toEqual(['s1', 's2']);
    expect(plan.message).toMatch(/^Added 2 liked items\n/);
  });

  it('shows no "Added by" for your own stops or on a trip of one', () => {
    const day = '2026-11-12';
    const mine = itineraryEntries(group, day, members).filter((e) => e.id !== 'item-04');
    expect(mine.every((e) => e.addedBy === null)).toBe(true);
    // Willem's dinner.
    expect(itineraryEntries(group, day, members).find((e) => e.id === 'item-04')!.addedBy).toBe(
      'Willem',
    );
    expect(itineraryEntries(group, day).every((e) => e.addedBy === null)).toBe(true);
  });
});

describe('Plan my bucket list on the group trip (TR-64)', () => {
  it('places the liked items first and keeps who added them', () => {
    let n = 0;
    const plan = planBucketAll(group, () => `p${++n}`);
    const order = plan.change!.save.slice(0, 2).map((s) => s.placeId);
    expect(order).toEqual(['place-golden-tiki', 'place-lotus-of-siam']);
    expect(plan.change!.save[0].addedBy).toBe(BLAKE);
  });
});
