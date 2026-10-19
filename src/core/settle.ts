/**
 * Who owes whom on a group trip (ADR 0030). Pure TypeScript. For each expense, every participant
 * other than the payer owes the payer their share, converted to the trip currency once per share
 * (rounded half-up at the expense's stored rate); recorded payments reduce the debt. Debts are
 * offset per pair (`net = a→b − b→a`): "you owe Blake $10, Blake owes you $6" is "You owe Blake
 * $4". No group-wide simplification.
 */

import type { Money, Rates } from './money';
import { atTripRate, type Share, type StoredRate } from './split';

/** An expense as the balances need it: who paid and the stored shares, already resolved. */
export interface LedgerExpense extends StoredRate {
  id: string;
  title: string;
  /** ISO instant; null when it has no date. */
  paidAt: string | null;
  /** Profile id. */
  paidBy: string;
  amountMinor: number;
  currency: string;
  /** In the expense's currency. */
  shares: readonly Share[];
}

/** Money one traveller sent another (the settle-up ticket stores these; none until then). */
export interface LedgerPayment {
  id: string;
  fromUser: string;
  toUser: string;
  amountMinor: number;
  currency: string;
  /** ISO instant. */
  createdAt: string;
}

export type BalanceDirection = 'youOwe' | 'owesYou' | 'settled';

export interface PairBalance {
  memberId: string;
  /** Always ≥ 0, in the trip currency's minor units; `direction` says which way. */
  amountMinor: number;
  direction: BalanceDirection;
}

export interface Ledger {
  expenses: readonly LedgerExpense[];
  payments: readonly LedgerPayment[];
  tripCurrency: string;
  /** Today's rates for amounts without a stored rate for the trip currency; may be missing. */
  rates?: Rates | null;
}

/** One expense or payment between two people, and what it did to what they owe each other. */
export interface HistoryLine {
  kind: 'expense' | 'payment';
  id: string;
  /** The expense's title; empty for a payment. */
  title: string;
  /** ISO instant, or null. */
  date: string | null;
  /** Who paid (the expense's payer, or the payment's sender). */
  paidBy: string;
  /** The whole expense or payment as paid. */
  amount: Money;
  /** Whose share this line is about: the other person's when `paidBy` paid for them. */
  shareOf: string | null;
  /** That share, as paid (expense currency); null for a payment. */
  share: Money | null;
  /**
   * The line's effect from the first person's side, in the trip currency: positive means the
   * second person owes them more (or they owe less); negative the other way.
   */
  effectMinor: number;
}

const moneyOf = (amountMinor: number, currency: string): Money => ({ amountMinor, currency });

/**
 * A share converted to the trip currency, or null when nothing converts it. `expense` gives the
 * stored rate.
 */
function shareInTrip(share: Share, expense: LedgerExpense, ledger: Ledger): number | null {
  const converted = atTripRate(
    { amountMinor: share.shareMinor, currency: expense.currency },
    expense,
    ledger.tripCurrency,
    ledger.rates,
  );
  return converted?.amountMinor ?? null;
}

function paymentInTrip(payment: LedgerPayment, ledger: Ledger): number | null {
  return atTripRate(payment, {}, ledger.tripCurrency, ledger.rates)?.amountMinor ?? null;
}

/**
 * Every line between `a` and `b`, oldest first, with its effect from `a`'s side. Lines that can't
 * be converted (no stored rate, no rates) are left out.
 */
function linesBetween(a: string, b: string, ledger: Ledger): HistoryLine[] {
  const lines: HistoryLine[] = [];
  if (a === b) return lines;
  for (const expense of ledger.expenses) {
    const payer = expense.paidBy;
    if (payer !== a && payer !== b) continue;
    const other = payer === a ? b : a;
    const share = expense.shares.find((s) => s.userId === other);
    if (!share || share.shareMinor === 0) continue;
    const converted = shareInTrip(share, expense, ledger);
    if (converted === null) continue;
    lines.push({
      kind: 'expense',
      id: expense.id,
      title: expense.title,
      date: expense.paidAt,
      paidBy: payer,
      amount: moneyOf(expense.amountMinor, expense.currency),
      shareOf: other,
      share: moneyOf(share.shareMinor, expense.currency),
      // b owes a when a paid for b.
      effectMinor: payer === a ? converted : -converted,
    });
  }
  for (const payment of ledger.payments) {
    const between =
      (payment.fromUser === a && payment.toUser === b) ||
      (payment.fromUser === b && payment.toUser === a);
    if (!between) continue;
    const converted = paymentInTrip(payment, ledger);
    if (converted === null) continue;
    lines.push({
      kind: 'payment',
      id: payment.id,
      title: '',
      date: payment.createdAt,
      paidBy: payment.fromUser,
      amount: moneyOf(payment.amountMinor, payment.currency),
      shareOf: null,
      share: null,
      // a paying b reduces what a owes b (or makes b owe a).
      effectMinor: payment.fromUser === a ? converted : -converted,
    });
  }
  return lines;
}

/** What `b` owes `me` after offsetting, in trip-currency minor units (negative: you owe them). */
export function netBetween(me: string, b: string, ledger: Ledger): number {
  return linesBetween(me, b, ledger).reduce((sum, line) => sum + line.effectMinor, 0);
}

/**
 * The balance with each other member, in the order given, from `me`'s side: "You owe Blake $4.00",
 * "Willem owes you $57.60", or settled.
 */
export function pairBalances(
  ledger: Ledger,
  me: string,
  memberIds: readonly string[],
): PairBalance[] {
  return memberIds
    .filter((id) => id !== me)
    .map((memberId) => {
      const net = netBetween(me, memberId, ledger);
      return {
        memberId,
        amountMinor: Math.abs(net),
        direction: net > 0 ? 'owesYou' : net < 0 ? 'youOwe' : 'settled',
      };
    });
}

/** The sum over your pairs, from your side: positive means others owe you overall. */
export function overallNet(balances: readonly PairBalance[]): number {
  return balances.reduce(
    (sum, b) =>
      sum +
      (b.direction === 'owesYou' ? b.amountMinor : b.direction === 'youOwe' ? -b.amountMinor : 0),
    0,
  );
}

const time = (date: string | null) => (date ? Date.parse(date) : Number.NEGATIVE_INFINITY);

/**
 * The expenses and payments between two people, newest first (undated last), each with its effect
 * from `a`'s side.
 */
export function history(a: string, b: string, ledger: Ledger): HistoryLine[] {
  return linesBetween(a, b, ledger).sort(
    (x, y) => time(y.date) - time(x.date) || (x.id < y.id ? -1 : x.id > y.id ? 1 : 0),
  );
}
