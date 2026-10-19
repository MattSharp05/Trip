import { compareIds } from '@/core/split';

import { checkRow, check, client, type Row } from '../shared/supabase';
import type { Expense, ExpensesSource, Share } from './types';

/** What an expense read embeds: its shares (`select('*, expense_shares(user_id, share_minor)')`). */
export const EXPENSE_SELECT = '*, expense_shares(user_id, share_minor)';

type ExpenseRow = Row<'expenses'> & {
  expense_shares?: Pick<Row<'expense_shares'>, 'user_id' | 'share_minor'>[] | null;
};

export const toExpense = (r: ExpenseRow): Expense => ({
  id: r.id,
  tripId: r.trip_id,
  amountMinor: r.amount_minor,
  currency: r.currency,
  category: r.category ?? 'Other',
  bookingId: r.booking_id,
  paidAt: r.paid_at,
  addedBy: r.user_id,
  ...(r.description ? { description: r.description } : {}),
  ...(r.paid_by ? { paidBy: r.paid_by } : {}),
  itineraryItemId: r.itinerary_item_id ?? null,
  rateToTrip: r.rate_to_trip ?? null,
  tripCurrency: r.trip_currency ?? null,
  ...(r.expense_shares?.length
    ? {
        shares: r.expense_shares
          .map((s) => ({ userId: s.user_id, shareMinor: s.share_minor }))
          .sort((a, b) => compareIds(a.userId, b.userId)),
      }
    : {}),
});

/** The expenses slice of the Supabase source. */
export const supabaseExpenses: ExpensesSource = {
  async saveExpense(expense) {
    const supabase = client();
    const row = checkRow(
      await supabase
        .from('expenses')
        .upsert({
          id: expense.id,
          trip_id: expense.tripId,
          amount_minor: expense.amountMinor,
          currency: expense.currency,
          category: expense.category,
          booking_id: expense.bookingId,
          paid_at: expense.paidAt,
          description: expense.description ?? null,
          ...(expense.paidBy ? { paid_by: expense.paidBy } : {}),
          itinerary_item_id: expense.itineraryItemId ?? null,
          rate_to_trip: expense.rateToTrip ?? null,
          trip_currency: expense.tripCurrency ?? null,
        })
        .select()
        .single(),
    );
    if (expense.shares?.length) await setShares(expense.id, expense.shares);
    return { ...toExpense(row), ...(expense.shares?.length ? { shares: expense.shares } : {}) };
  },
  setExpenseShares: setShares,
};

/** Replaced in one transaction by the RPC, which checks they add up to the amount. */
async function setShares(expenseId: string, shares: Share[]) {
  check(
    await client().rpc('set_expense_shares', {
      expense: expenseId,
      shares: shares.map((s) => ({ user_id: s.userId, share_minor: s.shareMinor })),
    }),
  );
}
