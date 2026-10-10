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
}

/** The expenses slice of `DataSource`. */
export interface ExpensesSource {
  saveExpense(expense: Expense): Promise<Expense>;
}
