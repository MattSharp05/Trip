import * as SecureStore from 'expo-secure-store';
import { useCallback, useEffect } from 'react';

import { now } from '@/core/clock';
import { defaultTrip } from '@/core/trips';
import { useDataSource, type Trip } from '@/services/data';
import { useTripStore } from '@/stores/trip';

/**
 * The selected trip survives relaunches on a real account: its id is kept on the device. Scenario
 * demo sessions never read or write it, so QA links leave the user's choice alone.
 */
const KEY = 'trip.selectedTripId';

async function loadSelectedTripId(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(KEY);
  } catch {
    return null;
  }
}

async function saveSelectedTripId(id: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(KEY, id);
  } catch {
    // Losing the remembered trip only means the next launch picks the default one.
  }
}

/** Select a trip for Plan, Organize and Discover, and remember it on a real account. */
export function useChooseTrip(): (tripId: string) => void {
  const source = useDataSource();
  const selectTrip = useTripStore((s) => s.selectTrip);
  return useCallback(
    (tripId: string) => {
      selectTrip(tripId);
      if (source.kind === 'supabase') void saveSelectedTripId(tripId);
    },
    [selectTrip, source.kind],
  );
}

/**
 * With nothing (or a deleted trip) selected on a real account, restore the remembered trip, else
 * pick the next upcoming one, so Plan always has a trip to show.
 */
export function useRestoreSelectedTrip(trips: readonly Trip[] | undefined): void {
  const source = useDataSource();
  const selected = useTripStore((s) => s.selectedTripId);

  useEffect(() => {
    if (source.kind !== 'supabase' || !trips?.length) return;
    if (selected && trips.some((t) => t.id === selected)) return;
    let cancelled = false;
    void loadSelectedTripId().then((stored) => {
      if (cancelled) return;
      const trip = trips.find((t) => t.id === stored) ?? defaultTrip(trips, now());
      if (trip) useTripStore.getState().selectTrip(trip.id);
    });
    return () => {
      cancelled = true;
    };
  }, [source.kind, trips, selected]);
}
