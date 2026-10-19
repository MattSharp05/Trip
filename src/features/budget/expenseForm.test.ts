import {
  buildExpense,
  defaultExpenseCurrency,
  newExpenseId,
  type ExpenseDraft,
} from './expenseForm';

const trip = { id: 'trip-vegas', timezone: 'America/Los_Angeles' };
const draft: ExpenseDraft = {
  amount: '8,400',
  currency: 'JPY',
  category: 'Food & Drinks',
  note: ' Ramen ',
  day: '2026-11-13',
  paidBy: 'me',
  participants: ['me'],
};

describe('expense form', () => {
  it('defaults to the trip country’s currency when rates cover it, else home', () => {
    const convertible = ['USD', 'EUR', 'JPY'];
    expect(defaultExpenseCurrency({ country: 'Japan' }, 'USD', convertible)).toBe('JPY');
    expect(defaultExpenseCurrency({ country: 'France' }, 'USD', convertible)).toBe('EUR');
    expect(defaultExpenseCurrency({ country: 'Narnia' }, 'GBP', convertible)).toBe('GBP');
    expect(defaultExpenseCurrency({ country: 'Thailand' }, 'USD', convertible)).toBe('USD');
    expect(defaultExpenseCurrency({ country: null }, 'USD', convertible)).toBe('USD');
  });

  it('builds an expense in its own currency, paid at noon local time', () => {
    expect(buildExpense(draft, trip, 'id-1')).toEqual({
      expense: {
        id: 'id-1',
        tripId: 'trip-vegas',
        amountMinor: 8400,
        currency: 'JPY',
        category: 'Food & Drinks',
        bookingId: null,
        paidAt: '2026-11-13T20:00:00.000Z',
        description: 'Ramen',
        paidBy: 'me',
        shares: [{ userId: 'me', shareMinor: 8400 }],
        itineraryItemId: null,
      },
    });
    const noNote = buildExpense({ ...draft, note: '  ' }, trip, 'id-2');
    expect('expense' in noNote && noNote.expense.description).toBeUndefined();
  });

  it('explains a missing or invalid amount', () => {
    expect(buildExpense({ ...draft, amount: '' }, trip)).toEqual({ error: 'Enter an amount.' });
    expect(buildExpense({ ...draft, amount: '1.5' }, trip)).toEqual({
      error: 'JPY has no cents: enter a whole amount, like 8400.',
    });
    expect(buildExpense({ ...draft, amount: 'abc', currency: 'USD' }, trip)).toEqual({
      error: 'Enter an amount like 12.50.',
    });
  });

  it('splits equally between the participants, paid by whoever paid', () => {
    const result = buildExpense(
      { ...draft, amount: '10', currency: 'USD', paidBy: 'blake', participants: ['c', 'a', 'b'] },
      trip,
    );
    expect('expense' in result && result.expense).toMatchObject({
      paidBy: 'blake',
      shares: [
        { userId: 'a', shareMinor: 334 },
        { userId: 'b', shareMinor: 333 },
        { userId: 'c', shareMinor: 333 },
      ],
    });
  });

  it('links the activity and needs someone to split with', () => {
    const linked = buildExpense({ ...draft, itineraryItemId: 'item-07' }, trip);
    expect('expense' in linked && linked.expense.itineraryItemId).toBe('item-07');
    expect(buildExpense({ ...draft, participants: [] }, trip)).toEqual({
      error: "Pick who it's split with.",
    });
  });

  it('makes uuid v4 ids', () => {
    expect(newExpenseId()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(newExpenseId(() => 0)).toBe('00000000-0000-4000-8000-000000000000');
  });
});
