/**
 * Everyone's flights (TR-58, ADR 0027). A flight booking stays private to the traveller who added
 * it, but the group sees each leg's route and local times (`trip_flights`), to plan pickups.
 */

import type { Airport, LocalDateTime } from '../bookings/types';

/** One flight leg on the trip, as every member sees it: no seat, confirmation or pass. */
export interface TripFlight {
  bookingId: string;
  /** Who is flying: the profile id that added the booking. */
  travelerId: string;
  airline: string;
  flightNumber: string;
  from: Airport;
  to: Airport;
  departs: LocalDateTime;
  arrives: LocalDateTime;
}

/** The flights slice of `DataSource`. */
export interface FlightsSource {
  /** Every member's flight legs on the trip, by departure; empty for a trip you're not on. */
  listTripFlights(tripId: string): Promise<TripFlight[]>;
}
