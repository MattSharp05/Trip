import { checkRow, client, type Row } from '../shared/supabase';
import type { Expense, ExpensesSource } from './types';

export const toExpense = (r: Row<'expenses'>): Expense => ({
  id: r.id,
  tripId: r.trip_id,
  amountMinor: r.amount_minor,
  currency: r.currency,
  category: r.category ?? 'Other',
  bookingId: r.booking_id,
  paidAt: r.paid_at,
  ...(r.description ? { description: r.description } : {}),
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
        })
        .select()
        .single(),
    );
    return toExpense(row);
  },
};
