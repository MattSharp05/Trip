import type { Database } from '../../database.types';
import { checkRow, client } from '../shared/supabase';
import type { FlightsSource, TripFlight } from './types';

type FlightRow = Database['public']['Functions']['trip_flights']['Returns'][number];

/** A `trip_flights` row; null when the booking's JSON lacks a time (nothing to place it at). */
export function toTripFlight(r: FlightRow): TripFlight | null {
  const at = (date: string | null, time: string | null, timezone: string | null) =>
    date && time && timezone ? { date, time, timezone } : null;
  const departs = at(r.departs_date, r.departs_time, r.departs_timezone);
  const arrives = at(r.arrives_date, r.arrives_time, r.arrives_timezone);
  if (!departs || !arrives || !r.from_code || !r.to_code) return null;
  return {
    bookingId: r.booking_id,
    travelerId: r.traveler_id,
    airline: r.airline ?? '',
    flightNumber: r.flight_number ?? '',
    from: { code: r.from_code, city: r.from_city ?? r.from_code, placeId: r.from_place_id ?? null },
    to: { code: r.to_code, city: r.to_city ?? r.to_code, placeId: r.to_place_id ?? null },
    departs,
    arrives,
  };
}

/** The flights slice of the Supabase source: the `trip_flights` RPC (0058_trip_flights.sql). */
export const supabaseFlights: FlightsSource = {
  async listTripFlights(tripId) {
    const rows = checkRow(await client().rpc('trip_flights', { trip: tripId }));
    return rows.flatMap((r) => toTripFlight(r) ?? []);
  },
};
