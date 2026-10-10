import { useQuery } from '@tanstack/react-query';

import { useDataSource } from '../active';
import { dataKeys, queryClient, useWrite } from '../shared/query';
import type { ProfileInput } from './types';

/** Everyone on the trip: you first, then the owner, then by name. */
export function useTripMembers(tripId: string | null) {
  const source = useDataSource();
  return useQuery(
    {
      queryKey: dataKeys.members(source, tripId ?? ''),
      queryFn: () => source.listMembers(tripId ?? ''),
      enabled: tripId !== null,
    },
    queryClient,
  );
}

/** Your name and payment handles. */
export function useMyProfile() {
  const source = useDataSource();
  return useQuery(
    { queryKey: dataKeys.myProfile(source), queryFn: () => source.getMyProfile() },
    queryClient,
  );
}

export const useSaveMyProfile = () =>
  useWrite((s, profile: ProfileInput) => s.saveMyProfile(profile));
export const useLeaveTrip = () => useWrite((s, tripId: string) => s.leaveTrip(tripId));
export const useRemoveMember = () =>
  useWrite((s, { tripId, userId }: { tripId: string; userId: string }) =>
    s.removeMember(tripId, userId),
  );
