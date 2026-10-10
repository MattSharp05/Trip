import { mockInserts, mockRows, mockTables, mockUpdates } from '../shared/supabaseMock';
import { supabaseTrips } from './supabase';

jest.mock('../../supabase', () => jest.requireActual('../shared/supabaseMock').mockSupabaseModule);

describe('supabase trips', () => {
  it('maps rows to the app model', async () => {
    mockTables.trips = { data: [mockRows.trip], error: null };
    expect(await supabaseTrips.listTrips()).toEqual([
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
      data: { ...mockRows.trip, budget_minor: 250000, budget_currency: 'USD' },
      error: null,
    };
    const trip = await supabaseTrips.saveTripBudget('t1', {
      amountMinor: 250000,
      currency: 'USD',
    });
    expect(mockUpdates.at(-1)).toEqual({ budget_minor: 250000, budget_currency: 'USD' });
    expect(trip.budget).toEqual({ amountMinor: 250000, currency: 'USD' });
    mockTables.trips = { data: mockRows.trip, error: null };
    await supabaseTrips.saveTripBudget('t1', null);
    expect(mockUpdates.at(-1)).toEqual({ budget_minor: null, budget_currency: null });
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
        ...mockRows.trip,
        city: 'Lisbon',
        cover_photo_url: 'https://img',
        cover_photo_credit: credit,
      },
      error: null,
    };
    const trip = await supabaseTrips.createTrip({
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

  it('reads a trip back with each bucket item joined to its link', async () => {
    const bucketRow = mockRows.bucket;
    mockTables.trips = { data: mockRows.trip, error: null };
    mockTables.itinerary_items = { data: [], error: null };
    mockTables.bookings = { data: [], error: null };
    mockTables.expenses = { data: [], error: null };
    mockTables.bucket_items = {
      data: [bucketRow, { ...bucketRow, id: 'k3', saved_link_id: null }],
      error: null,
    };
    mockTables.saved_links = { data: [mockRows.link], error: null };
    mockTables.places = { data: [], error: null };
    const trip = await supabaseTrips.getTripData('t1');
    expect(trip?.bucketItems[0].link).toMatchObject({ id: 'l1', url: mockRows.link.url });
    expect(trip?.bucketItems[1]).not.toHaveProperty('link');
  });
});
