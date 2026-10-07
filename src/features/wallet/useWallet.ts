import { useMemo } from 'react';

import { useDocuments, useTripData } from '@/services/data';
import { useTripStore } from '@/stores/trip';

import { buildWallet, placeLookup, type PlaceLookup, type WalletEntry } from './walletItems';

export interface WalletState {
  entries: WalletEntry[];
  places: PlaceLookup;
  isLoading: boolean;
  /** No trip selected: only the account's documents show. */
  noTrip: boolean;
  /** The trip or the documents couldn't load (offline): show an error with `retry`, not "empty". */
  loadError: boolean;
  retry: () => void;
}

/** The selected trip's bookings plus the account's documents, in wallet order. */
export function useWallet(): WalletState {
  const tripId = useTripStore((s) => s.selectedTripId);
  const tripData = useTripData(tripId);
  const documents = useDocuments();

  const { refetch: refetchTrip } = tripData;
  const { refetch: refetchDocuments } = documents;
  const tripFailed = tripId !== null && tripData.isError && tripData.data === undefined;
  const documentsFailed = documents.isError && documents.data === undefined;

  return useMemo(() => {
    const bookings = tripData.data?.bookings ?? [];
    const loadError = tripFailed || documentsFailed;
    return {
      entries: buildWallet(bookings, documents.data ?? []),
      places: placeLookup(tripData.data?.places ?? []),
      isLoading: !loadError && (documents.isPending || (tripId !== null && tripData.isPending)),
      noTrip: tripId === null,
      loadError,
      retry: () => {
        if (tripFailed) void refetchTrip();
        if (documentsFailed) void refetchDocuments();
      },
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
  ]);
}
