import { useMemo } from 'react';

import { now } from '@/core/clock';
import { filterTrips } from '@/core/trips';
import { useCityReels } from '@/services/cityLinks';
import { useTripData, useTrips, type Trip } from '@/services/data';
import { eventsRequest, useTripEvents } from '@/services/events';

import { filterEvents, filterPopular, type DiscoverFilter } from './discover';
import { popularPlaces } from './popular';
import { filterReels } from './reels';
import { useDiscoverSave } from './useDiscoverSave';

/**
 * Everything Discover shows for one trip (TR-31; extracted for TR-33): its data, the events on its
 * dates narrowed by the chip and search, the curated places, the saved videos for its city
 * (TR-34; under All only), and the `+` that saves to its Bucket List. The selected-trip view uses it once; "All upcoming trips" once per trip section.
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
  const cityReels = useCityReels(trip?.city);

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
  const reels = useMemo(
    () => (filter === 'all' ? filterReels(cityReels.data ?? [], query) : []),
    [cityReels.data, filter, query],
  );

  return {
    data,
    /** The trip itself couldn't load (offline): an error with Try again, not a skeleton. */
    tripError: tripData.isError && !data,
    retryTrip: tripData.refetch,
    trip,
    events,
    eventList,
    popular,
    reels,
    save,
    /** The trip has no place or dates yet, so there's nothing to ask about. */
    noPlace: !!trip && !eventsRequest(trip),
  };
}

/** Trips that haven't ended yet ("today" from the scenario's clock), soonest first. */
export function useUpcomingTrips(): {
  trips: Trip[] | undefined;
  isPending: boolean;
  isError: boolean;
  retry: () => void;
} {
  const { data, isPending, isError, refetch } = useTrips();
  const trips = useMemo(() => (data ? filterTrips(data, 'upcoming', now()) : undefined), [data]);
  return { trips, isPending, isError: isError && !data, retry: () => void refetch() };
}
