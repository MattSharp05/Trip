import { mockCalls, mockTables } from '../shared/supabaseMock';
import { supabaseFlights, toTripFlight } from './supabase';

jest.mock('../../supabase', () => jest.requireActual('../shared/supabaseMock').mockSupabaseModule);

const row = {
  booking_id: 'b1',
  traveler_id: 'u2',
  airline: 'United Airlines',
  flight_number: 'UA 1187',
  from_code: 'ORD',
  from_city: 'Chicago',
  from_place_id: null,
  to_code: 'LAS',
  to_city: 'Las Vegas',
  to_place_id: 'p1',
  departs_date: '2026-11-12',
  departs_time: '11:50',
  departs_timezone: 'America/Chicago',
  arrives_date: '2026-11-12',
  arrives_time: '14:10',
  arrives_timezone: 'America/Los_Angeles',
} as unknown as Parameters<typeof toTripFlight>[0];

describe('supabase trip flights', () => {
  it('calls trip_flights and maps its rows', async () => {
    mockTables['rpc:trip_flights'] = { data: [row], error: null };
    mockCalls.length = 0;
    expect(await supabaseFlights.listTripFlights('t1')).toEqual([
      {
        bookingId: 'b1',
        travelerId: 'u2',
        airline: 'United Airlines',
        flightNumber: 'UA 1187',
        from: { code: 'ORD', city: 'Chicago', placeId: null },
        to: { code: 'LAS', city: 'Las Vegas', placeId: 'p1' },
        departs: { date: '2026-11-12', time: '11:50', timezone: 'America/Chicago' },
        arrives: { date: '2026-11-12', time: '14:10', timezone: 'America/Los_Angeles' },
      },
    ]);
    expect(mockCalls).toEqual([['rpc', 'trip_flights', { trip: 't1' }]]);
  });

  it('skips a leg without times, and names a city by its code when missing', async () => {
    mockTables['rpc:trip_flights'] = {
      data: [
        { ...row, arrives_time: null },
        { ...row, booking_id: 'b2', from_city: null },
      ],
      error: null,
    };
    const flights = await supabaseFlights.listTripFlights('t1');
    expect(flights.map((f) => [f.bookingId, f.from.city])).toEqual([['b2', 'ORD']]);
  });

  it('throws the RPC’s error', async () => {
    mockTables['rpc:trip_flights'] = { data: null, error: { message: 'boom' } };
    await expect(supabaseFlights.listTripFlights('t1')).rejects.toThrow('boom');
  });
});
