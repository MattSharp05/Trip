import type { DemoStore } from '../shared/demo';
import type { Airport } from '../bookings/types';
import type { FlightAirport, FlightsSource, TripFlight } from './types';

/**
 * The flights slice of the demo source: the flight bookings of everyone on the trip, whatever
 * their visibility, cut down to what `trip_flights` returns.
 */
export function demoFlights(store: DemoStore): FlightsSource {
  return {
    async listTripFlights(tripId) {
      const { db } = store;
      // Like the RPC: members only.
      const onTrip = (userId: string) =>
        db.members.some((m) => m.tripId === tripId && m.userId === userId);
      if (!onTrip(db.me)) return [];
      const at = (airport: Airport): FlightAirport => {
        const place = db.places.find((p) => p.id === airport.placeId);
        return place && place.lat !== null && place.lng !== null
          ? { ...airport, lat: place.lat, lng: place.lng }
          : { ...airport };
      };
      return db.bookings
        .flatMap((b): TripFlight[] =>
          // A shared booking outlives its traveller leaving; their legs don't show.
          b.tripId === tripId && b.type === 'flight' && onTrip(b.addedBy ?? db.me)
            ? [
                {
                  bookingId: b.id,
                  travelerId: b.addedBy ?? db.me,
                  airline: b.data.airline,
                  flightNumber: b.data.flightNumber,
                  from: at(b.data.from),
                  to: at(b.data.to),
                  departs: { ...b.data.departs },
                  arrives: { ...b.data.arrives },
                },
              ]
            : [],
        )
        .sort((a, b) =>
          `${a.departs.date} ${a.departs.time}`.localeCompare(
            `${b.departs.date} ${b.departs.time}`,
          ),
        );
    },
  };
}
