import { mockUpserts, mockTables } from '../shared/supabaseMock';
import { supabaseExpenses } from './supabase';

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
});
