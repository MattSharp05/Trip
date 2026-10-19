import { formatMoney, type Money, type Rates } from '@/core/money';
import type { HistoryLine, Ledger, LedgerExpense, PairBalance } from '@/core/settle';
import type { Expense } from '@/services/data/types';

import { expenseTitle, payerOf, sharesOf } from './budget';

/** The trip's expenses as the balances read them: who paid and the shares, v1 data resolved. */
export function toLedger(
  expenses: readonly Expense[],
  me: string,
  tripCurrency: string,
  rates: Rates | null | undefined,
): Ledger {
  const ledgerExpenses: LedgerExpense[] = expenses.map((e) => ({
    id: e.id,
    title: expenseTitle(e),
    paidAt: e.paidAt,
    paidBy: payerOf(e, me),
    amountMinor: e.amountMinor,
    currency: e.currency,
    shares: sharesOf(e, me),
    rateToTrip: e.rateToTrip,
    tripCurrency: e.tripCurrency,
  }));
  // Payments arrive with settle-up (TR-67); until then there are none.
  return { expenses: ledgerExpenses, payments: [], tripCurrency, rates };
}

/** A balance row's two parts: the label in secondary text, the amount in white. */
export function balanceParts(
  balance: PairBalance,
  currency: string,
): { label: string; amount: string | null } {
  const amount = formatMoney({ amountMinor: balance.amountMinor, currency });
  if (balance.direction === 'youOwe') return { label: 'You owe', amount };
  if (balance.direction === 'owesYou') return { label: 'Owes you', amount };
  return { label: 'Settled up', amount: null };
}

/** The line over the list: "Overall you owe $92.40", "Overall you're owed $4.00", "All settled up". */
export function overallLine(netMinor: number, currency: string): string {
  const amount = formatMoney({ amountMinor: Math.abs(netMinor), currency });
  if (netMinor < 0) return `Overall you owe ${amount}`;
  if (netMinor > 0) return `Overall you're owed ${amount}`;
  return 'All settled up';
}

/** The Person screen's headline: "You owe Blake", "Willem owes you", "You and Blake are settled up". */
export function personHeadline(balance: PairBalance, name: string): string {
  if (balance.direction === 'youOwe') return `You owe ${name}`;
  if (balance.direction === 'owesYou') return `${name} owes you`;
  return `You and ${name} are settled up`;
}

/**
 * Whose share a history line is about, and what it is: "Your share" or "Willem's share", with the
 * share as paid. A payment: "Payment" and the amount sent.
 */
export function historyShare(
  line: HistoryLine,
  me: string,
  nameOf: (id: string) => string,
): { label: string; amount: Money } {
  if (line.kind === 'payment' || !line.share || !line.shareOf) {
    return { label: 'Payment', amount: line.amount };
  }
  const label = line.shareOf === me ? 'Your share' : `${nameOf(line.shareOf)}'s share`;
  return { label, amount: line.share };
}
