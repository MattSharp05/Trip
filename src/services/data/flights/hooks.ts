import { useQuery } from '@tanstack/react-query';

import { useDataSource } from '../active';
import { dataKeys, queryClient } from '../shared/query';

/** Every member's flight legs on the trip (TR-58), under the trip's key so it refreshes with it. */
export function useTripFlights(tripId: string | null) {
  const source = useDataSource();
  return useQuery(
    {
      queryKey: [...dataKeys.trip(source, tripId ?? ''), 'flights'],
      queryFn: () => source.listTripFlights(tripId ?? ''),
      enabled: tripId !== null,
    },
    queryClient,
  );
}
