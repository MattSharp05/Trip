import { useMemo } from 'react';

import { now } from '@/core/clock';
import { filterTrips } from '@/core/trips';
import { useTripData, useTrips, type Trip } from '@/services/data';
import { eventsRequest, useTripEvents } from '@/services/events';

import { filterEvents, filterPopular, type DiscoverFilter } from './discover';
import { popularPlaces } from './popular';
import { useDiscoverSave } from './useDiscoverSave';

/**
 * Everything Discover shows for one trip (TR-31; extracted for TR-33): its data, the events on its
 * dates narrowed by the chip and search, the curated places, and the `+` that saves to its
 * Bucket List. The selected-trip view uses it once; "All upcoming trips" once per trip section.
 */
export function useDiscover(
  tripId: string | null,
  filter: DiscoverFilter,
  query: string,
  notify: (message: string) => void,
) {
  const tripData = useTripData(tripId);
  const data = tripData.data;
  const trip = data?.trip;
  const events = useTripEvents(trip);
  const save = useDiscoverSave(tripId, data?.places, notify);

  const eventList = useMemo(
    () => (data ? filterEvents(events.data ?? [], filter, query) : []),
    [data, events.data, filter, query],
  );
  const popular = useMemo(
    () =>
      trip && filter !== 'events' && filter !== 'sports' && filter !== 'networking'
        ? filterPopular(popularPlaces(trip.city), filter, query)
        : [],
    [trip, filter, query],
  );

  return {
    data,
    trip,
    events,
    eventList,
    popular,
    save,
    /** The trip has no place or dates yet, so there's nothing to ask about. */
    noPlace: !!trip && !eventsRequest(trip),
  };
}

/** Trips that haven't ended yet ("today" from the scenario's clock), soonest first. */
export function useUpcomingTrips(): { trips: Trip[] | undefined; isPending: boolean } {
  const { data, isPending } = useTrips();
  const trips = useMemo(() => (data ? filterTrips(data, 'upcoming', now()) : undefined), [data]);
  return { trips, isPending };
}
