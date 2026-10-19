import type { Expense } from '@/services/data';
import { expenseRate } from '@/services/rates';

/**
 * The expense with its rate to the trip currency for the day it was paid (`YYYY-MM-DD`), stored on
 * it so every member sees the same numbers (ADR 0030). A demo session uses the fixed demo rates.
 * When the rate can't load it's saved without one, and screens convert at today's rates.
 */
export async function withTripRate(
  expense: Expense,
  tripCurrency: string,
  day: string,
  { demo }: { demo: boolean },
): Promise<Expense> {
  const rate = await expenseRate(day, expense.currency, tripCurrency, { demo });
  return { ...expense, tripCurrency, rateToTrip: rate };
}
