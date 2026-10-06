import type { Rates } from '@/core/money';
import { demoRates } from '@/scenarios/fixtures/rates';
import { expenses as vegasExpenses } from '@/scenarios/fixtures/vegas';
import type { Expense } from '@/services/data/types';

import { categoryOf, CATEGORIES, expenseTitle, recentFirst, summarize } from './budget';

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
