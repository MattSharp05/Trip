import { queryClient } from '@/services/data/hooks';

import { buildExpense } from './expenseForm';
import { withTripRate } from './tripRate';

describe('withTripRate', () => {
  const realFetch = global.fetch;
  beforeEach(() => queryClient.clear());
  afterEach(() => {
    global.fetch = realFetch;
  });

  it("saving €120 on Oct 1 stores that day's Frankfurter rate and 6000/6000 shares", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ amount: 1, base: 'EUR', date: '2026-10-01', rates: { USD: 1.1298 } }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    const built = buildExpense(
      {
        amount: '120',
        currency: 'EUR',
        category: 'Food & Drinks',
        note: 'Dinner',
        day: '2026-10-01',
        paidBy: 'user-matthew',
        participants: ['user-matthew', 'user-willem'],
      },
      { id: 'trip-vegas', timezone: 'America/Los_Angeles' },
      'e1',
    );
    if (!('expense' in built)) throw new Error(built.error);
    const saved = await withTripRate(built.expense, 'USD', '2026-10-01', { demo: false });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.frankfurter.dev/v1/2026-10-01?base=EUR&symbols=USD',
    );
    expect(saved).toMatchObject({
      rateToTrip: 1.1298,
      tripCurrency: 'USD',
      shares: [
        { userId: 'user-matthew', shareMinor: 6000 },
        { userId: 'user-willem', shareMinor: 6000 },
      ],
    });
  });

  it('stores rate 1 in the trip currency, and no rate when it cannot load', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('offline')) as unknown as typeof fetch;
    const expense = {
      id: 'e2',
      tripId: 't',
      amountMinor: 3600,
      currency: 'USD',
      category: 'Transport',
      bookingId: null,
      paidAt: null,
    };
    await expect(
      withTripRate(expense, 'USD', '2026-10-01', { demo: false }),
    ).resolves.toMatchObject({ rateToTrip: 1, tripCurrency: 'USD' });
    await expect(
      withTripRate({ ...expense, currency: 'EUR' }, 'USD', '2026-10-01', { demo: false }),
    ).resolves.toMatchObject({ rateToTrip: null, tripCurrency: 'USD' });
  });
});
