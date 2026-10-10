import { useQuery } from '@tanstack/react-query';

import type { Money } from '@/core/money';

import { useDataSource } from '../active';
import { dataKeys, queryClient, useWrite } from '../shared/query';
import type { NewTrip } from './types';

export function useTrips() {
  const source = useDataSource();
  return useQuery(
    { queryKey: dataKeys.trips(source), queryFn: () => source.listTrips() },
    queryClient,
  );
}

/** A trip with its places, itinerary, bookings, bucket list and expenses. */
export function useTripData(tripId: string | null) {
  const source = useDataSource();
  return useQuery(
    {
      queryKey: dataKeys.trip(source, tripId ?? ''),
      queryFn: () => source.getTripData(tripId ?? ''),
      enabled: tripId !== null,
    },
    queryClient,
  );
}

export const useCreateTrip = () => useWrite((s, trip: NewTrip) => s.createTrip(trip));
export const useSaveTripBudget = () =>
  useWrite((s, { tripId, budget }: { tripId: string; budget: Money | null }) =>
    s.saveTripBudget(tripId, budget),
  );
