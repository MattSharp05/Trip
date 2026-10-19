import { useMemo } from 'react';

import { FALLBACK_NAME, memberLabel } from '@/core/members';
import { useDocuments, useMyProfile, useTripData, useTripMembers } from '@/services/data';
import { useTripStore } from '@/stores/trip';

import {
  buildWallet,
  documentsFor,
  placeLookup,
  type PlaceLookup,
  type WalletEntry,
} from './walletItems';

export interface WalletState {
  entries: WalletEntry[];
  places: PlaceLookup;
  isLoading: boolean;
  /** No trip selected: only the account's documents show. */
  noTrip: boolean;
  /** The trip or the documents couldn't load (offline): show an error with `retry`, not "empty". */
  loadError: boolean;
  retry: () => void;
  /** Your profile id, once known: who "Mine" is. */
  me: string | null;
  tripId: string | null;
  /** More than one traveller on the trip: the wallet splits into Mine and Shared. */
  isGroup: boolean;
  /** A member's name ("You" for you) for "Added by". */
  nameOf: (id: string) => string;
}

/** The selected trip's bookings plus the account's documents, in wallet order. */
export function useWallet(): WalletState {
  const tripId = useTripStore((s) => s.selectedTripId);
  const tripData = useTripData(tripId);
  const documents = useDocuments();
  const members = useTripMembers(tripId);
  const profile = useMyProfile();

  const { refetch: refetchTrip } = tripData;
  const { refetch: refetchDocuments } = documents;
  const tripFailed = tripId !== null && tripData.isError && tripData.data === undefined;
  const documentsFailed = documents.isError && documents.data === undefined;
  const memberList = members.data;
  const me = memberList?.find((m) => m.isMe)?.id ?? profile.data?.id ?? null;
  const meLoading = me === null && profile.isPending;

  return useMemo(() => {
    const bookings = tripData.data?.bookings ?? [];
    const loadError = tripFailed || documentsFailed;
    const docs = documents.data ?? [];
    const nameOf = (id: string) => {
      const member = memberList?.find((m) => m.id === id);
      return member ? memberLabel(member) : FALLBACK_NAME;
    };
    return {
      entries: buildWallet(bookings, documentsFor(docs, me, tripId)),
      places: placeLookup(tripData.data?.places ?? []),
      isLoading:
        !loadError && (documents.isPending || meLoading || (tripId !== null && tripData.isPending)),
      noTrip: tripId === null,
      loadError,
      retry: () => {
        if (tripFailed) void refetchTrip();
        if (documentsFailed) void refetchDocuments();
      },
      me,
      tripId,
      isGroup: me !== null && (memberList?.length ?? 0) > 1,
      nameOf,
    };
  }, [
    tripId,
    tripData.data,
    tripData.isPending,
    documents.data,
    documents.isPending,
    tripFailed,
    documentsFailed,
    refetchTrip,
    refetchDocuments,
    memberList,
    me,
    meLoading,
  ]);
}
