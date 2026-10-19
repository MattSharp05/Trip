import { copy, type DemoStore, upsert } from '../shared/demo';
import type { ExpensesSource } from './types';

/** The expenses slice of the demo source. */
export function demoExpenses(store: DemoStore): ExpensesSource {
  return {
    async saveExpense(expense) {
      store.db = { ...store.db, expenses: upsert(store.db.expenses, copy(expense)) };
      return copy(expense);
    },
    async setExpenseShares(expenseId, shares) {
      const expense = store.db.expenses.find((e) => e.id === expenseId);
      if (!expense) throw new Error(`No expense ${expenseId}`);
      const total = shares.reduce((sum, s) => sum + s.shareMinor, 0);
      if (total !== expense.amountMinor) throw new Error('Shares must add up to the amount');
      store.db = {
        ...store.db,
        expenses: upsert(store.db.expenses, { ...expense, shares: copy(shares) }),
      };
    },
  };
}
