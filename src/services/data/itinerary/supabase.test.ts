import { mockUpserts, mockTables } from '../shared/supabaseMock';
import { supabaseItinerary } from './supabase';

jest.mock('../../supabase', () => jest.requireActual('../shared/supabaseMock').mockSupabaseModule);

const itemRow = {
  id: 'i1',
  user_id: 'u1',
  trip_id: 't1',
  day: '2026-11-13',
  start_time: '10:00:00',
  duration_minutes: 75,
  place_id: 'p1',
  kind: 'food',
  booking_id: null,
  fixed: false,
  title: 'Brunch',
  notes: 'Terrace table',
  created_at: '',
  updated_at: '',
};

describe('supabase itinerary', () => {
  it('trims Postgres times to HH:MM and writes snake_case rows', async () => {
    mockTables.itinerary_items = { data: itemRow, error: null };
    const saved = await supabaseItinerary.saveItineraryItem({
      id: 'i1',
      tripId: 't1',
      day: '2026-11-13',
      startTime: '10:00',
      durationMinutes: 75,
      placeId: 'p1',
      kind: 'food',
      bookingId: null,
      fixed: false,
      title: 'Brunch',
      notes: 'Terrace table',
    });
    expect(saved).toMatchObject({ startTime: '10:00', title: 'Brunch', notes: 'Terrace table' });
    expect(mockUpserts.at(-1)).toMatchObject({
      trip_id: 't1',
      start_time: '10:00',
      place_id: 'p1',
      title: 'Brunch',
      notes: 'Terrace table',
    });
    expect(saved.addedBy).toBe('u1');
    expect(mockUpserts.at(-1)).not.toHaveProperty('added_by');
  });

  it('reads and keeps who added a stop (a Bucket List item planned by someone else)', async () => {
    mockTables.itinerary_items = { data: { ...itemRow, added_by: 'u2' }, error: null };
    const saved = await supabaseItinerary.saveItineraryItem({
      id: 'i1',
      tripId: 't1',
      day: '2026-11-13',
      startTime: '10:00',
      durationMinutes: 75,
      placeId: 'p1',
      kind: 'food',
      bookingId: null,
      fixed: false,
      addedBy: 'u2',
    });
    expect(mockUpserts.at(-1)).toMatchObject({ added_by: 'u2' });
    expect(saved.addedBy).toBe('u2');
  });
});
