import { supabaseSource } from './supabaseSource';

// A chainable stand-in for supabase-js: every builder call returns itself, awaiting it resolves to
// the table's canned response.
const mockTables: Record<string, { data: unknown; error: { message: string } | null }> = {};
const mockUpserts: unknown[] = [];
const mockInserts: unknown[] = [];
const mockUpdates: unknown[] = [];

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
      builder.update = (row: unknown) => {
        mockUpdates.push(row);
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
  budget_minor: null,
  budget_currency: null,
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
        budget: null,
      },
    ]);
  });

  it('reads and writes a trip budget as minor units + currency', async () => {
    mockTables.trips = {
      data: { ...tripRow, budget_minor: 250000, budget_currency: 'USD' },
      error: null,
    };
    const trip = await supabaseSource.saveTripBudget('t1', {
      amountMinor: 250000,
      currency: 'USD',
    });
    expect(mockUpdates.at(-1)).toEqual({ budget_minor: 250000, budget_currency: 'USD' });
    expect(trip.budget).toEqual({ amountMinor: 250000, currency: 'USD' });
    mockTables.trips = { data: tripRow, error: null };
    await supabaseSource.saveTripBudget('t1', null);
    expect(mockUpdates.at(-1)).toEqual({ budget_minor: null, budget_currency: null });
  });

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
    const saved = await supabaseSource.saveExpense({
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

  it('saves a booking by updating its JSON data and original path', async () => {
    const data = { confirmation: 'KXJ4PL', passCrop: { x: 0.1, y: 0.5, width: 0.6, height: 0.3 } };
    mockTables.bookings = {
      data: { id: 'b1', trip_id: 't1', type: 'flight', original_path: null, data },
      error: null,
    };
    const saved = await supabaseSource.saveBooking({
      id: 'b1',
      tripId: 't1',
      originalPath: null,
      type: 'flight',
      data: data as never,
    });
    expect(mockUpdates.at(-1)).toEqual({ data, original_path: null });
    expect(saved).toMatchObject({ id: 'b1', type: 'flight', data });
  });

  it('adds a place without an id, letting Postgres make one', async () => {
    mockTables.places = {
      data: {
        id: 'p9',
        user_id: 'u1',
        name: 'Eggslut',
        address: '3708 Las Vegas Blvd S, Las Vegas',
        lat: 36.11,
        lng: -115.17,
        kind: 'food',
        photo_url: null,
        source_url: null,
        created_at: '',
        updated_at: '',
      },
      error: null,
    };
    const saved = await supabaseSource.savePlace({
      name: 'Eggslut',
      address: '3708 Las Vegas Blvd S, Las Vegas',
      lat: 36.11,
      lng: -115.17,
      kind: 'food',
      photoUrl: null,
      sourceUrl: null,
    });
    expect(mockUpserts.at(-1)).not.toHaveProperty('id');
    expect(mockUpserts.at(-1)).toMatchObject({ name: 'Eggslut', photo_url: null });
    expect(saved).toMatchObject({ id: 'p9', name: 'Eggslut', kind: 'food' });
  });

  it('inserts imported bookings with the id the app chose', async () => {
    const data = { event: 'La Colombe', placeId: 'p9' };
    mockTables.bookings = {
      data: { id: 'b9', trip_id: 't1', type: 'ticket', data, original_path: 'u1/imports/a.pdf' },
      error: null,
    };
    const saved = await supabaseSource.createBooking({
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

  it('throws the query error', async () => {
    mockTables.documents = { data: null, error: { message: 'JWT expired' } };
    await expect(supabaseSource.listDocuments()).rejects.toThrow('JWT expired');
  });
});
