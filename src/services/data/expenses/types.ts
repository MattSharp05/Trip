export interface Expense {
  id: string;
  tripId: string;
  amountMinor: number;
  currency: string;
  category: string;
  bookingId: string | null;
  /** ISO instant. */
  paidAt: string | null;
  /** What it was for ("Sphere tickets"); optional. */
  description?: string;
}

/** The expenses slice of `DataSource`. */
export interface ExpensesSource {
  saveExpense(expense: Expense): Promise<Expense>;
}
