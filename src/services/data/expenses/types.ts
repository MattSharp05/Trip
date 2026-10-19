import type { Share } from '@/core/split';

export type { Share };

export interface Expense {
  id: string;
  tripId: string;
  amountMinor: number;
  currency: string;
  category: string;
  bookingId: string | null;
  /** ISO instant. */
  paidAt: string | null;
  /** Who added it (profile id); absent in v1 fixtures, meaning you. */
  addedBy?: string;
  /** What it was for ("Sphere tickets"); optional. */
  description?: string;
  /** Who paid (profile id); absent in v1 fixtures, meaning whoever added it. */
  paidBy?: string;
  /** The activity it belongs to (same trip), if any. */
  itineraryItemId?: string | null;
  /**
   * Who it's split with and how much each owes, in the expense's currency (ADR 0030). Absent or
   * empty (v1 data) means one share for the payer.
   */
  shares?: Share[];
  /** Trip-currency units one unit of `currency` bought on the day, captured at save. */
  rateToTrip?: number | null;
  /** The trip currency `rateToTrip` converts to. */
  tripCurrency?: string | null;
}

/** The expenses slice of `DataSource`. */
export interface ExpensesSource {
  saveExpense(expense: Expense): Promise<Expense>;
}
