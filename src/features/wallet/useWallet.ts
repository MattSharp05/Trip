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
}

/** The selected trip's bookings plus the account's documents, in wallet order. */
export function useWallet(): WalletState {
  const tripId = useTripStore((s) => s.selectedTripId);
  const tripData = useTripData(tripId);
  const documents = useDocuments();

  return useMemo(() => {
    const bookings = tripData.data?.bookings ?? [];
    return {
      entries: buildWallet(bookings, documents.data ?? []),
      places: placeLookup(tripData.data?.places ?? []),
      isLoading: documents.isPending || (tripId !== null && tripData.isPending),
      noTrip: tripId === null,
    };
  }, [tripId, tripData.data, tripData.isPending, documents.data, documents.isPending]);
}
