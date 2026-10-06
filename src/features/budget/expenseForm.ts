import { currencyForCountry } from '@/core/countryCurrency';
import { instantIn } from '@/core/dates';
import { currencyDecimals, parseAmount } from '@/core/money';
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
}

/** A random RFC 4122 v4 id (the expenses table's primary key is a uuid). Not for secrets. */
export function newExpenseId(random: () => number = Math.random): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.floor(random() * 16);
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/** The expense to save, or the message to show under the amount. Noon local time on its day. */
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
    },
  };
}
