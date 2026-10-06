import { QueryClient, useMutation, useQuery } from '@tanstack/react-query';

import { useDataSource } from './active';
import type { DataSource } from './source';
import type { BucketItem, Expense, ItineraryItem } from './types';

/**
 * One client for the app. Hooks pass it explicitly, so they work without a provider in the
 * root layout.
 */
export const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
});

export const dataKeys = {
  all: (source: DataSource) => ['data', source.id] as const,
  trips: (source: DataSource) => ['data', source.id, 'trips'] as const,
  trip: (source: DataSource, tripId: string) => ['data', source.id, 'trip', tripId] as const,
  documents: (source: DataSource) => ['data', source.id, 'documents'] as const,
};

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

export function useDocuments() {
  const source = useDataSource();
  return useQuery(
    { queryKey: dataKeys.documents(source), queryFn: () => source.listDocuments() },
    queryClient,
  );
}

function useWrite<T>(write: (source: DataSource, value: T) => Promise<unknown>) {
  const source = useDataSource();
  return useMutation(
    {
      mutationFn: (value: T) => write(source, value),
      onSuccess: () => queryClient.invalidateQueries({ queryKey: dataKeys.all(source) }),
    },
    queryClient,
  );
}

export const useSaveItineraryItem = () =>
  useWrite((s, item: ItineraryItem) => s.saveItineraryItem(item));
export const useDeleteItineraryItem = () => useWrite((s, id: string) => s.deleteItineraryItem(id));
export const useSaveBucketItem = () => useWrite((s, item: BucketItem) => s.saveBucketItem(item));
export const useDeleteBucketItem = () => useWrite((s, id: string) => s.deleteBucketItem(id));
export const useSaveExpense = () => useWrite((s, expense: Expense) => s.saveExpense(expense));
