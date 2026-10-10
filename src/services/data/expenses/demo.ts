import { copy, type DemoStore, upsert } from '../shared/demo';
import type { ExpensesSource } from './types';

/** The expenses slice of the demo source. */
export function demoExpenses(store: DemoStore): ExpensesSource {
  return {
    async saveExpense(expense) {
      store.db = { ...store.db, expenses: upsert(store.db.expenses, copy(expense)) };
      return copy(expense);
    },
  };
}
