import { supabaseSource } from './supabaseSource';

// A chainable stand-in for supabase-js: every builder call returns itself, awaiting it resolves to
// the table's canned response.
const mockTables: Record<string, { data: unknown; error: { message: string } | null }> = {};
const mockUpserts: unknown[] = [];
const mockInserts: unknown[] = [];

jest.mock('../supabase', () => ({
  supabase: {
    from: (table: string) => {
      const builder: any = {
        then: (resolve: (v: unknown) => void) => resolve(mockTables[table]),
      };
      for (const m of ['select', 'order', 'eq', 'in', 'delete', 'single', 'maybeSingle']) {
        builder[m] = () => builder;
      }
      builder.insert = (row: unknown) => {
        mockInserts.push(row);
        return builder;
      };
      builder.upsert = (row: unknown) => {
        mockUpserts.push(row);
        return builder;
      };
      return builder;
    },
  },
}));

const tripRow = {
  id: 't1',
  user_id: 'u1',
  city: 'Las Vegas',
  country: 'United States',
  lat: 36.1,
  lng: -115.1,
  timezone: 'America/Los_Angeles',
  start_date: '2026-11-12',
  end_date: '2026-11-16',
  cover_photo_url: null,
  cover_photo_credit: null,
  created_at: '',
  updated_at: '',
};

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
  created_at: '',
  updated_at: '',
};

describe('supabase source', () => {
  it('maps rows to the app model', async () => {
    mockTables.trips = { data: [tripRow], error: null };
    expect(await supabaseSource.listTrips()).toEqual([
      {
        id: 't1',
        city: 'Las Vegas',
        country: 'United States',
        lat: 36.1,
        lng: -115.1,
        timezone: 'America/Los_Angeles',
        startDate: '2026-11-12',
        endDate: '2026-11-16',
        coverPhotoUrl: null,
        coverPhotoCredit: null,
      },
    ]);
  });

  it('creates a trip with its cover credit as snake_case', async () => {
    const credit = {
      source: 'unsplash' as const,
      photographer: 'Ana Lisboa',
      photographerUrl: 'https://unsplash.com/@ana',
      photoUrl: 'https://unsplash.com/photos/x',
    };
    mockTables.trips = {
      data: {
        ...tripRow,
        city: 'Lisbon',
        cover_photo_url: 'https://img',
        cover_photo_credit: credit,
      },
      error: null,
    };
    const trip = await supabaseSource.createTrip({
      city: 'Lisbon',
      country: 'Portugal',
      lat: 38.7,
      lng: -9.1,
      timezone: 'Europe/Lisbon',
      startDate: '2027-04-03',
      endDate: '2027-04-08',
      coverPhotoUrl: 'https://img',
      coverPhotoCredit: credit,
    });
    expect(mockInserts.at(-1)).toEqual({
      city: 'Lisbon',
      country: 'Portugal',
      lat: 38.7,
      lng: -9.1,
      timezone: 'Europe/Lisbon',
      start_date: '2027-04-03',
      end_date: '2027-04-08',
      cover_photo_url: 'https://img',
      cover_photo_credit: credit,
    });
    expect(trip).toMatchObject({ id: 't1', city: 'Lisbon', coverPhotoCredit: credit });
  });

  it('trims Postgres times to HH:MM and writes snake_case rows', async () => {
    mockTables.itinerary_items = { data: itemRow, error: null };
    const saved = await supabaseSource.saveItineraryItem({
      id: 'i1',
      tripId: 't1',
      day: '2026-11-13',
      startTime: '10:00',
      durationMinutes: 75,
      placeId: 'p1',
      kind: 'food',
      bookingId: null,
      fixed: false,
    });
    expect(saved.startTime).toBe('10:00');
    expect(mockUpserts.at(-1)).toMatchObject({
      trip_id: 't1',
      start_time: '10:00',
      place_id: 'p1',
    });
  });

  it('throws the query error', async () => {
    mockTables.documents = { data: null, error: { message: 'JWT expired' } };
    await expect(supabaseSource.listDocuments()).rejects.toThrow('JWT expired');
  });
});
