import { goingIds, resplit, type Share } from '@/core/split';

import { withGoing } from '../itinerary/optOuts';
import type { ItineraryItem } from '../itinerary/types';
import type { Expense } from './types';

/** An expense's new shares. */
export interface Resplit {
  expenseId: string;
  shares: Share[];
}

/**
 * The activity's expenses whose split changes when `me` goes in or out of it (TR-66, ADR 0030):
 * those still split equally between everyone going, recomputed for who is going now. A split
 * someone customised, and v1 expenses without shares, stay as they are.
 */
export function resplitsForGoing(
  expenses: readonly Expense[],
  item: ItineraryItem,
  memberIds: readonly string[],
  me: string,
  going: boolean,
): Resplit[] {
  const before = goingIds(memberIds, withGoing(item, me, !going).optedOut);
  const after = goingIds(memberIds, withGoing(item, me, going).optedOut);
  return expenses.flatMap((e) => {
    if (e.itineraryItemId !== item.id || !e.shares?.length) return [];
    const shares = resplit(e.amountMinor, e.shares, before, after);
    return shares ? [{ expenseId: e.id, shares }] : [];
  });
}
