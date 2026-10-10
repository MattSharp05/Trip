import { QueryClient, useMutation } from '@tanstack/react-query';

import { useDataSource } from '../active';
import type { DataSource } from '../source';

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
  /** Under the trip's key, so refreshing a trip refreshes its members too. */
  members: (source: DataSource, tripId: string) =>
    ['data', source.id, 'trip', tripId, 'members'] as const,
  myProfile: (source: DataSource) => ['data', source.id, 'profile'] as const,
  invite: (source: DataSource, token: string) => ['data', source.id, 'invite', token] as const,
};

/** A write through the active source that refreshes all of its queries when it succeeds. */
export function useWrite<T, R>(write: (source: DataSource, value: T) => Promise<R>) {
  const source = useDataSource();
  return useMutation(
    {
      mutationFn: (value: T) => write(source, value),
      onSuccess: () => queryClient.invalidateQueries({ queryKey: dataKeys.all(source) }),
    },
    queryClient,
  );
}
