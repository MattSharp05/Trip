import { checkRow, check, client, type Row } from '../shared/supabase';
import type { Expense, ExpensesSource } from './types';

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
          .sort((a, b) => (a.userId < b.userId ? -1 : a.userId > b.userId ? 1 : 0)),
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
    // Replaced in one transaction by the RPC, which checks they add up to the amount.
    if (expense.shares?.length) {
      check(
        await supabase.rpc('set_expense_shares', {
          expense: expense.id,
          shares: expense.shares.map((s) => ({ user_id: s.userId, share_minor: s.shareMinor })),
        }),
      );
    }
    return { ...toExpense(row), ...(expense.shares?.length ? { shares: expense.shares } : {}) };
  },
};
