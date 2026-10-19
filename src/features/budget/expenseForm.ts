import { currencyForCountry } from '@/core/countryCurrency';
import { instantIn } from '@/core/dates';
import { newId } from '@/core/ids';
import { currencyDecimals, parseAmount } from '@/core/money';
import { equalShares } from '@/core/split';
import type { Expense, Trip } from '@/services/data/types';

import type { Category } from './budget';

/**
 * The currency a new expense starts in: the trip country's, when rates cover it (it's on the
 * convertible list), else the traveller's home currency.
 */
export function defaultExpenseCurrency(
  trip: Pick<Trip, 'country'>,
  homeCurrency: string,
  convertible: readonly string[],
): string {
  const local = currencyForCountry(trip.country);
  return local && convertible.includes(local) ? local : homeCurrency;
}

export interface ExpenseDraft {
  amount: string;
  currency: string;
  category: Category;
  note: string;
  /** `YYYY-MM-DD` in the trip's timezone. */
  day: string;
  /** Who paid (profile id). */
  paidBy: string;
  /** Who it's split with, equally (profile ids). */
  participants: readonly string[];
  /** The activity it belongs to, if any. */
  itineraryItemId?: string | null;
}

/** A random RFC 4122 v4 id (the expenses table's primary key is a uuid). */
export const newExpenseId = newId;

/**
 * The expense to save, split equally between the participants (ADR 0030), or the message to show
 * under the amount. Noon local time on its day. The trip-currency rate is added on save
 * (`withTripRate`).
 */
export function buildExpense(
  draft: ExpenseDraft,
  trip: Pick<Trip, 'id' | 'timezone'>,
  id: string = newExpenseId(),
): { expense: Expense } | { error: string } {
  const amountMinor = parseAmount(draft.amount, draft.currency);
  if (amountMinor === null) {
    if (!draft.amount.trim()) return { error: 'Enter an amount.' };
    return {
      error:
        currencyDecimals(draft.currency) === 0
          ? `${draft.currency} has no cents: enter a whole amount, like 8400.`
          : 'Enter an amount like 12.50.',
    };
  }
  if (draft.participants.length === 0) return { error: "Pick who it's split with." };
  const note = draft.note.trim();
  return {
    expense: {
      id,
      tripId: trip.id,
      amountMinor,
      currency: draft.currency,
      category: draft.category,
      bookingId: null,
      paidAt: instantIn(trip.timezone, draft.day, '12:00'),
      ...(note ? { description: note } : {}),
      paidBy: draft.paidBy,
      shares: equalShares(amountMinor, draft.participants),
      itineraryItemId: draft.itineraryItemId ?? null,
    },
  };
}
