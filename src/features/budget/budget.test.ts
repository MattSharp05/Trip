import type { Rates } from '@/core/money';
import { demoRates } from '@/scenarios/fixtures/rates';
import { expenses as vegasExpenses } from '@/scenarios/fixtures/vegas';
import type { Expense } from '@/services/data/types';

import {
  categoryOf,
  CATEGORIES,
  expenseTitle,
  needsLiveRate,
  recentFirst,
  sharesOf,
  splitLine,
  summarize,
  tripAmount,
  tripCurrencyOf,
} from './budget';

const expense = (id: string, amountMinor: number, currency: string, category: string): Expense => ({
  id,
  tripId: 't',
  amountMinor,
  currency,
  category,
  bookingId: null,
  paidAt: null,
});

const RATES: Rates = { base: 'USD', date: '2026-11-13', rates: { EUR: 0.5, JPY: 150 } };

describe('budget summary', () => {
  it('totals each category in the display currency, every category listed', () => {
    const s = summarize(
      [
        expense('a', 1000, 'USD', 'Food & Drinks'),
        expense('b', 500, 'EUR', 'Food & Drinks'),
        expense('c', 3000, 'JPY', 'Activities'),
        expense('d', 100, 'USD', 'Souvenirs'),
      ],
      { amountMinor: 10000, currency: 'USD' },
      'USD',
      RATES,
    );
    expect(s.categories.map((c) => c.category)).toEqual(CATEGORIES.map((c) => c.name));
    const by = Object.fromEntries(s.categories.map((c) => [c.category, c]));
    // $10 + €5 (= $10).
    expect(by['Food & Drinks'].total).toEqual({ amountMinor: 2000, currency: 'USD' });
    expect(by['Food & Drinks'].count).toBe(2);
    // ¥3,000 = $20.
    expect(by.Activities.total).toEqual({ amountMinor: 2000, currency: 'USD' });
    // Unknown categories count as Other.
    expect(by.Other.total.amountMinor).toBe(100);
    expect(by.Flights.total.amountMinor).toBe(0);
    expect(s.spent).toEqual({ amountMinor: 4100, currency: 'USD' });
    expect(s.total).toEqual({ amountMinor: 10000, currency: 'USD' });
    expect(s.left).toEqual({ amountMinor: 5900, currency: 'USD' });
    expect(s.progress).toBeCloseTo(0.41);
    expect(s.unconverted).toEqual([]);
  });

  it('category totals add up to spent, in whole yen', () => {
    const s = summarize(
      vegasExpenses,
      { amountMinor: 250000, currency: 'USD' },
      'JPY',
      demoRates('JPY'),
    );
    const sum = s.categories.reduce((t, c) => t + c.total.amountMinor, 0);
    expect(sum).toBe(s.spent.amountMinor);
    expect(Number.isInteger(s.spent.amountMinor)).toBe(true);
    expect(s.spent.currency).toBe('JPY');
  });

  it('caps progress, goes negative when over budget, and handles no budget', () => {
    const over = summarize(
      [expense('a', 15000, 'USD', 'Hotels')],
      { amountMinor: 10000, currency: 'USD' },
      'USD',
      null,
    );
    expect(over.progress).toBe(1);
    expect(over.left?.amountMinor).toBe(-5000);
    const none = summarize([expense('a', 15000, 'USD', 'Hotels')], null, 'USD', null);
    expect(none.total).toBeNull();
    expect(none.left).toBeNull();
    expect(none.progress).toBe(0);
  });

  it('leaves expenses it can’t convert out of the totals', () => {
    const s = summarize(
      [expense('a', 1000, 'USD', 'Other'), expense('b', 5000, 'XYZ', 'Other')],
      null,
      'USD',
      RATES,
    );
    expect(s.spent.amountMinor).toBe(1000);
    expect(s.unconverted.map((e) => e.id)).toEqual(['b']);
    // Without rates, only same-currency amounts count.
    expect(
      summarize([expense('a', 500, 'EUR', 'Other')], null, 'USD', null).unconverted,
    ).toHaveLength(1);
  });

  it('sorts recent first, undated last, and names rows', () => {
    const rows = recentFirst([
      { ...expense('a', 1, 'USD', 'Other'), paidAt: '2026-11-12T08:00:00-05:00' },
      { ...expense('b', 1, 'USD', 'Other'), paidAt: null },
      { ...expense('c', 1, 'USD', 'Other'), paidAt: '2026-11-13T22:00:00-08:00' },
    ]);
    expect(rows.map((r) => r.id)).toEqual(['c', 'a', 'b']);
    expect(expenseTitle({ ...expense('a', 1, 'USD', 'Hotels'), description: ' Cosmo ' })).toBe(
      'Cosmo',
    );
    expect(expenseTitle(expense('a', 1, 'USD', 'Hotels'))).toBe('Hotels');
    expect(categoryOf({ category: 'Flights' })).toBe('Flights');
  });
});

describe('shared expenses', () => {
  const names: Record<string, string> = { me: 'You', blake: 'Blake', willem: 'Willem' };
  const nameOf = (id: string) => names[id] ?? 'Traveller';

  it('reads v1 expenses as one share for whoever added them', () => {
    const v1 = expense('a', 2500, 'USD', 'Other');
    expect(sharesOf(v1, 'me')).toEqual([{ userId: 'me', shareMinor: 2500 }]);
    expect(sharesOf({ ...v1, addedBy: 'blake' }, 'me')).toEqual([
      { userId: 'blake', shareMinor: 2500 },
    ]);
    expect(splitLine(v1, 'me', nameOf)).toBe('You paid');
  });

  it('says who paid and how many share it', () => {
    const sphere: Expense = {
      ...expense('s', 45000, 'USD', 'Activities'),
      paidBy: 'blake',
      shares: [
        { userId: 'blake', shareMinor: 15000 },
        { userId: 'me', shareMinor: 15000 },
        { userId: 'willem', shareMinor: 15000 },
      ],
    };
    expect(splitLine(sphere, 'me', nameOf)).toBe('Blake paid · split 3 ways');
    expect(
      splitLine(
        { ...sphere, paidBy: 'me', shares: [{ userId: 'willem', shareMinor: 45000 }] },
        'me',
        nameOf,
      ),
    ).toBe('You paid for Willem');
  });

  it('converts at the stored rate for the trip currency, else at today’s rates', () => {
    const dinner: Expense = {
      ...expense('d', 12000, 'EUR', 'Food & Drinks'),
      rateToTrip: 1.1298,
      tripCurrency: 'USD',
    };
    expect(tripAmount(dinner, 'USD', RATES)).toEqual({ amountMinor: 13558, currency: 'USD' });
    expect(needsLiveRate(dinner, 'USD')).toBe(false);
    // Trip currency changed since: today's rates.
    expect(tripAmount(dinner, 'JPY', RATES)).toEqual({ amountMinor: 36000, currency: 'JPY' });
    expect(needsLiveRate(dinner, 'JPY')).toBe(true);
    expect(tripAmount({ ...dinner, rateToTrip: null }, 'USD', RATES)).toEqual({
      amountMinor: 24000,
      currency: 'USD',
    });
    expect(tripAmount(dinner, 'EUR', null)).toEqual({ amountMinor: 12000, currency: 'EUR' });
  });

  it('uses the trip currency, else the budget’s, else USD', () => {
    expect(tripCurrencyOf({ currency: 'EUR', budget: null })).toBe('EUR');
    expect(tripCurrencyOf({ budget: { amountMinor: 1, currency: 'GBP' } })).toBe('GBP');
    expect(tripCurrencyOf({})).toBe('USD');
  });
});
