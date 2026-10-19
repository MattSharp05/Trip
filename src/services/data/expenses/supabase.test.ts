import { mockCalls, mockUpserts, mockTables } from '../shared/supabaseMock';
import { supabaseExpenses, toExpense } from './supabase';

jest.mock('../../supabase', () => jest.requireActual('../shared/supabaseMock').mockSupabaseModule);

describe('supabase expenses', () => {
  it('saves an expense with its note', async () => {
    mockTables.expenses = {
      data: {
        id: 'e1',
        user_id: 'u1',
        trip_id: 't1',
        amount_minor: 8400,
        currency: 'JPY',
        category: 'Food & Drinks',
        booking_id: null,
        paid_at: '2026-11-13T20:00:00.000Z',
        description: 'Ramen',
        created_at: '',
        updated_at: '',
      },
      error: null,
    };
    const saved = await supabaseExpenses.saveExpense({
      id: 'e1',
      tripId: 't1',
      amountMinor: 8400,
      currency: 'JPY',
      category: 'Food & Drinks',
      bookingId: null,
      paidAt: '2026-11-13T20:00:00.000Z',
      description: 'Ramen',
    });
    expect(mockUpserts.at(-1)).toMatchObject({ amount_minor: 8400, description: 'Ramen' });
    expect(saved).toMatchObject({ amountMinor: 8400, currency: 'JPY', description: 'Ramen' });
  });

  it('saves who paid, the activity and the rate, and replaces the shares in one call', async () => {
    mockTables.expenses = {
      data: {
        id: 'e2',
        user_id: 'u1',
        trip_id: 't1',
        amount_minor: 12000,
        currency: 'EUR',
        category: 'Food & Drinks',
        booking_id: null,
        paid_at: '2026-10-01T19:00:00.000Z',
        description: null,
        paid_by: 'u1',
        itinerary_item_id: 'i1',
        rate_to_trip: 1.1298,
        trip_currency: 'USD',
        created_at: '',
        updated_at: '',
      },
      error: null,
    };
    mockTables['rpc:set_expense_shares'] = { data: null, error: null };
    const shares = [
      { userId: 'u1', shareMinor: 6000 },
      { userId: 'u2', shareMinor: 6000 },
    ];
    const saved = await supabaseExpenses.saveExpense({
      id: 'e2',
      tripId: 't1',
      amountMinor: 12000,
      currency: 'EUR',
      category: 'Food & Drinks',
      bookingId: null,
      paidAt: '2026-10-01T19:00:00.000Z',
      paidBy: 'u1',
      itineraryItemId: 'i1',
      rateToTrip: 1.1298,
      tripCurrency: 'USD',
      shares,
    });
    expect(mockUpserts.at(-1)).toMatchObject({
      paid_by: 'u1',
      itinerary_item_id: 'i1',
      rate_to_trip: 1.1298,
      trip_currency: 'USD',
    });
    expect(mockCalls).toContainEqual([
      'rpc',
      'set_expense_shares',
      {
        expense: 'e2',
        shares: [
          { user_id: 'u1', share_minor: 6000 },
          { user_id: 'u2', share_minor: 6000 },
        ],
      },
    ]);
    expect(saved).toMatchObject({ paidBy: 'u1', rateToTrip: 1.1298, shares });
  });

  it('reads embedded shares, and none for a v1 expense', () => {
    const row = {
      id: 'e3',
      user_id: 'u1',
      trip_id: 't1',
      amount_minor: 1000,
      currency: 'USD',
      category: null,
      booking_id: null,
      paid_at: null,
      description: null,
      paid_by: 'u2',
      itinerary_item_id: null,
      rate_to_trip: null,
      trip_currency: null,
      created_at: '',
      updated_at: '',
    };
    expect(
      toExpense({
        ...row,
        expense_shares: [
          { user_id: 'u2', share_minor: 500 },
          { user_id: 'u1', share_minor: 500 },
        ],
      }).shares,
    ).toEqual([
      { userId: 'u1', shareMinor: 500 },
      { userId: 'u2', shareMinor: 500 },
    ]);
    expect(toExpense({ ...row, expense_shares: [] }).shares).toBeUndefined();
    expect(toExpense(row).paidBy).toBe('u2');
  });
});
