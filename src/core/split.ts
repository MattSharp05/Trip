/**
 * Splitting an expense between travellers (ADR 0030). Pure TypeScript: every device computes the
 * same shares, and the stored shares are the source of truth afterwards.
 */

import { toMajor, toMinor, type Money } from './money';

export interface Share {
  /** The participant's profile id. */
  userId: string;
  /** Their part of the expense, in the expense's currency's minor units. */
  shareMinor: number;
}

/** Profile ids in code-unit order: the order shares are listed and remainders handed out in. */
export const compareIds = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/**
 * An equal split: everyone gets `floor(amount / n)`, and the remainder's minor units go one each to
 * the first participants by id, so the shares always add up to the amount. Ordered by id;
 * duplicates count once. Empty for no participants.
 */
export function equalShares(amountMinor: number, participantIds: readonly string[]): Share[] {
  const ids = [...new Set(participantIds)].sort(compareIds);
  if (ids.length === 0) return [];
  const base = Math.floor(amountMinor / ids.length);
  const remainder = amountMinor - base * ids.length;
  return ids.map((userId, i) => ({ userId, shareMinor: base + (i < remainder ? 1 : 0) }));
}

/**
 * An amount in the trip currency at a stored rate (how many trip-currency units one unit buys),
 * rounded half-up to the trip currency's minor units: €60.00 at 1.1298 → $67.79.
 */
export function toTripCurrency(share: Money, rate: number, tripCurrency: string): Money {
  if (share.currency === tripCurrency) return { ...share };
  return {
    amountMinor: toMinor(toMajor(share.amountMinor, share.currency) * rate, tripCurrency),
    currency: tripCurrency,
  };
}
