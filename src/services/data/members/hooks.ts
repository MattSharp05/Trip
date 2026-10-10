import { useMutation, useQuery } from '@tanstack/react-query';

import { isInviteInactive } from '@/core/inviteLink';

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

/** What an invite link opens on (TR-57). An inactive link fails at once, without retrying. */
export function useInvitePreview(token: string, enabled = true) {
  const source = useDataSource();
  return useQuery(
    {
      queryKey: dataKeys.invite(source, token),
      queryFn: () => source.previewInvite(token),
      enabled,
      retry: (count, error) => !isInviteInactive(error) && count < 1,
    },
    queryClient,
  );
}

/** Join through an invite link; resolves to the trip's id and refreshes everything. */
export const useAcceptInvite = () => useWrite((s, token: string) => s.acceptInvite(token));

/**
 * The trip's invite token, made on first use, or (`reset: true`) a new one that replaces it. Reads
 * nothing the screens show, so it refreshes no queries.
 */
export function useInviteToken() {
  const source = useDataSource();
  return useMutation(
    {
      mutationFn: ({ tripId, reset = false }: { tripId: string; reset?: boolean }) =>
        reset ? source.resetInvite(tripId) : source.createInvite(tripId),
    },
    queryClient,
  );
}
