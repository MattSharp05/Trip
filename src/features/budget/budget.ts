import type { SFSymbol } from 'expo-symbols';

import { convert, type Money, type Rates } from '@/core/money';
import type { Expense } from '@/services/data/types';

/** The budget's categories, in the order the summary lists them, with their SF Symbol. */
export const CATEGORIES = [
  { name: 'Flights', icon: 'airplane' },
  { name: 'Hotels', icon: 'bed.double' },
  { name: 'Food & Drinks', icon: 'fork.knife' },
  { name: 'Activities', icon: 'ticket' },
  { name: 'Transport', icon: 'car' },
  { name: 'Other', icon: 'ellipsis' },
] as const satisfies readonly { name: string; icon: SFSymbol }[];

export type Category = (typeof CATEGORIES)[number]['name'];

const NAMES = new Set<string>(CATEGORIES.map((c) => c.name));

/** An expense's category as the summary groups it; anything unknown counts as Other. */
export function categoryOf(expense: Pick<Expense, 'category'>): Category {
  return NAMES.has(expense.category) ? (expense.category as Category) : 'Other';
}

export function categoryIcon(category: Category): SFSymbol {
  return CATEGORIES.find((c) => c.name === category)?.icon ?? 'ellipsis';
}

export interface CategoryTotal {
  category: Category;
  total: Money;
  count: number;
}

export interface BudgetSummary {
  /** The budget in the display currency; null when none is set (or it can't be converted). */
  total: Money | null;
  spent: Money;
  /** Total minus spent; negative when over budget. Null without a total. */
  left: Money | null;
  /** Share of the budget spent, 0–1 (capped). 0 without a total. */
  progress: number;
  /** Every category, in CATEGORIES order, including empty ones. */
  categories: CategoryTotal[];
  /** Expenses the rates can't convert (a currency Frankfurter doesn't cover): left out of totals. */
  unconverted: Expense[];
}

/**
 * Totals for the budget screen, all in the display currency. Each expense is converted on its own
 * and then summed, so a category total is exactly the sum of its rows as shown.
 */
export function summarize(
  expenses: readonly Expense[],
  budget: Money | null | undefined,
  display: string,
  rates: Rates | null | undefined,
): BudgetSummary {
  const totals = new Map<Category, CategoryTotal>(
    CATEGORIES.map((c) => [c.name, { category: c.name, total: zero(display), count: 0 }]),
  );
  const unconverted: Expense[] = [];
  let spent = 0;
  for (const expense of expenses) {
    const converted = convert(expense, display, rates);
    if (!converted) {
      unconverted.push(expense);
      continue;
    }
    const entry = totals.get(categoryOf(expense))!;
    entry.total = {
      amountMinor: entry.total.amountMinor + converted.amountMinor,
      currency: display,
    };
    entry.count += 1;
    spent += converted.amountMinor;
  }

  const total = budget ? convert(budget, display, rates) : null;
  const left = total ? { amountMinor: total.amountMinor - spent, currency: display } : null;
  const progress =
    total && total.amountMinor > 0 ? Math.min(1, Math.max(0, spent / total.amountMinor)) : 0;

  return {
    total,
    spent: { amountMinor: spent, currency: display },
    left,
    progress,
    categories: [...totals.values()],
    unconverted,
  };
}

const zero = (currency: string): Money => ({ amountMinor: 0, currency });

/** Most recent first; expenses without a date last. */
export function recentFirst(expenses: readonly Expense[]): Expense[] {
  return [...expenses].sort((a, b) => {
    if (a.paidAt === b.paidAt) return a.id.localeCompare(b.id);
    if (!a.paidAt) return 1;
    if (!b.paidAt) return -1;
    return Date.parse(b.paidAt) - Date.parse(a.paidAt);
  });
}

/** What a row is called: its note, else its category. */
export function expenseTitle(expense: Expense): string {
  return expense.description?.trim() || categoryOf(expense);
}
