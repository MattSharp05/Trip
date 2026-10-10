import { useWrite } from '../shared/query';
import type { Expense } from './types';

export const useSaveExpense = () => useWrite((s, expense: Expense) => s.saveExpense(expense));
