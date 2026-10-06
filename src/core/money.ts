/**
 * Money as integer minor units plus an ISO 4217 code (TDD → Conventions). Amounts are never kept
 * as floats: conversion works in major units for one step and rounds straight back to the target
 * currency's minor units. Pure TypeScript, no React Native.
 */

export interface Money {
  amountMinor: number;
  currency: string;
}

// ISO 4217 minor units that differ from the usual 2.
const ZERO_DECIMALS = new Set([
  'BIF',
  'CLP',
  'DJF',
  'GNF',
  'ISK',
  'JPY',
  'KMF',
  'KRW',
  'PYG',
  'RWF',
  'UGX',
  'VND',
  'VUV',
  'XAF',
  'XOF',
  'XPF',
]);
const THREE_DECIMALS = new Set(['BHD', 'IQD', 'JOD', 'KWD', 'LYD', 'OMR', 'TND']);

/** Digits after the decimal point: JPY 0, USD 2, KWD 3. */
export function currencyDecimals(currency: string): number {
  const code = currency.toUpperCase();
  if (ZERO_DECIMALS.has(code)) return 0;
  if (THREE_DECIMALS.has(code)) return 3;
  return 2;
}

const factor = (currency: string) => 10 ** currencyDecimals(currency);

/** Round half away from zero (so -0.5 → -1, like 0.5 → 1), on a value scaled to minor units. */
function roundMinor(value: number): number {
  // The epsilon absorbs float noise such as 1.005 * 100 = 100.49999999999999.
  const rounded = Math.sign(value) * Math.round(Math.abs(value) + 1e-9);
  return rounded === 0 ? 0 : rounded;
}

/** `12.5` USD → 1250; `8400` JPY → 8400. */
export function toMinor(major: number, currency: string): number {
  return roundMinor(major * factor(currency));
}

/** 1250 USD → 12.5. */
export function toMajor(amountMinor: number, currency: string): number {
  return amountMinor / factor(currency);
}

/**
 * What a person typed as an amount, in minor units: `8,400`, `12.50`, ` 7 `. Null for anything
 * that isn't a positive amount, or with more decimals than the currency has (`1.5` yen).
 */
export function parseAmount(text: string, currency: string): number | null {
  const cleaned = text.replace(/[\s,]/g, '');
  if (!/^\d+(\.\d*)?$|^\.\d+$/.test(cleaned)) return null;
  const decimals = cleaned.includes('.') ? cleaned.split('.')[1].length : 0;
  if (decimals > currencyDecimals(currency)) return null;
  const minor = toMinor(Number(cleaned), currency);
  return minor > 0 ? minor : null;
}

/**
 * Exchange rates against one base currency: `rates[code]` is how many `code` one unit of `base`
 * buys (Frankfurter's shape). The base itself counts as 1.
 */
export interface Rates {
  base: string;
  /** The day the rates are for, `YYYY-MM-DD`. */
  date: string;
  rates: Record<string, number>;
}

function rateOf(rates: Rates, currency: string): number | null {
  if (currency === rates.base) return 1;
  const rate = rates.rates[currency];
  return typeof rate === 'number' && rate > 0 ? rate : null;
}

/** True when `convert` can turn `from` into `to` with these rates. */
export function canConvert(from: string, to: string, rates: Rates | null | undefined): boolean {
  if (from === to) return true;
  return !!rates && rateOf(rates, from) !== null && rateOf(rates, to) !== null;
}

/**
 * The same amount in another currency, rounded to that currency's minor units. Null when the
 * rates don't cover either currency. The original is never changed.
 */
export function convert(money: Money, to: string, rates: Rates | null | undefined): Money | null {
  if (money.currency === to) return { amountMinor: money.amountMinor, currency: to };
  if (!rates) return null;
  const from = rateOf(rates, money.currency);
  const target = rateOf(rates, to);
  if (from === null || target === null) return null;
  const major = (toMajor(money.amountMinor, money.currency) / from) * target;
  return { amountMinor: toMinor(major, to), currency: to };
}

/** Sum of amounts already in one currency. */
export function sumMinor(amounts: readonly Money[], currency: string): Money {
  return {
    amountMinor: amounts.reduce((total, m) => {
      if (m.currency !== currency) throw new Error(`sumMinor: ${m.currency} is not ${currency}`);
      return total + m.amountMinor;
    }, 0),
    currency,
  };
}

export interface FormatOptions {
  /** Round to whole units: `$2,500`, not `$2,500.00` (summaries and category totals). */
  whole?: boolean;
}

/**
 * `$1,234.50`, `€130.00`, `¥8,400`. Symbols follow en-US (`CA$`, `A$`), so every currency reads
 * unambiguously. `whole` rounds to the nearest unit.
 */
export function formatMoney(money: Money, { whole = false }: FormatOptions = {}): string {
  const decimals = whole ? 0 : currencyDecimals(money.currency);
  const major = toMajor(money.amountMinor, money.currency);
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: money.currency,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(major);
  } catch {
    // An unknown code: still show the amount, with the code.
    return `${money.currency} ${major.toFixed(decimals)}`;
  }
}

/** The amount for an input field, no symbol or grouping: 1250 USD → `12.50`, 8400 JPY → `8400`. */
export function formatAmountInput(money: Money): string {
  return toMajor(money.amountMinor, money.currency).toFixed(currencyDecimals(money.currency));
}
