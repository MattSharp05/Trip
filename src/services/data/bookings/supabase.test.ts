import { mockInserts, mockTables, mockUpdates } from '../shared/supabaseMock';
import { supabaseBookings } from './supabase';

jest.mock('../../supabase', () => jest.requireActual('../shared/supabaseMock').mockSupabaseModule);

describe('supabase bookings', () => {
  it('saves a booking by updating its JSON data and original path', async () => {
    const data = { confirmation: 'KXJ4PL', passCrop: { x: 0.1, y: 0.5, width: 0.6, height: 0.3 } };
    mockTables.bookings = {
      data: { id: 'b1', trip_id: 't1', type: 'flight', original_path: null, data },
      error: null,
    };
    const saved = await supabaseBookings.saveBooking({
      id: 'b1',
      tripId: 't1',
      originalPath: null,
      type: 'flight',
      data: data as never,
    });
    expect(mockUpdates.at(-1)).toEqual({ data, original_path: null });
    expect(saved).toMatchObject({ id: 'b1', type: 'flight', data });
  });

  it('inserts imported bookings with the id the app chose', async () => {
    const data = { event: 'La Colombe', placeId: 'p9' };
    mockTables.bookings = {
      data: { id: 'b9', trip_id: 't1', type: 'ticket', data, original_path: 'u1/imports/a.pdf' },
      error: null,
    };
    const saved = await supabaseBookings.createBooking({
      id: 'b9',
      tripId: 't1',
      originalPath: 'u1/imports/a.pdf',
      type: 'ticket',
      data: data as never,
    });
    expect(mockInserts.at(-1)).toEqual({
      id: 'b9',
      trip_id: 't1',
      type: 'ticket',
      data,
      original_path: 'u1/imports/a.pdf',
    });
    expect(saved).toMatchObject({ id: 'b9', tripId: 't1', type: 'ticket' });
  });
});
