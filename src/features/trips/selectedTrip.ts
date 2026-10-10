import * as SecureStore from 'expo-secure-store';
import { useRouter } from 'expo-router';
import { useCallback, useEffect } from 'react';

import { now } from '@/core/clock';
import { defaultTrip } from '@/core/trips';
import { useDataSource, type Trip } from '@/services/data';
import { useSelectionStore, type SelectionTrip } from '@/stores/selection';
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
 * Open a trip (TR-56), the same from a trip card, a globe dot, the trip switcher and a joined invite
 * (TR-57): select it, start a different trip on its own opening day, and land on Plan with the
 * sheet at half and the map on show. `leave: true` closes the screen it's opened from (the
 * invite), so going back doesn't return to it.
 */
export function useOpenTrip(): (trip: SelectionTrip, options?: { leave?: boolean }) => void {
  const router = useRouter();
  const switchTrip = useSwitchTrip();
  return useCallback(
    (trip: SelectionTrip, { leave = false }: { leave?: boolean } = {}) => {
      if (useTripStore.getState().selectedTripId !== trip.id) switchTrip(trip);
      useTripStore.getState().countOpen();
      if (leave) router.dismissTo('/plan');
      else router.navigate('/plan');
    },
    [switchTrip, router],
  );
}

/**
 * Show another trip in Plan, Organize and Discover, starting fresh on its own opening day (not a
 * scenario's); null shows none.
 */
export function useSwitchTrip(): (trip: SelectionTrip | null) => void {
  const chooseTrip = useChooseTrip();
  return useCallback(
    (trip: SelectionTrip | null) => {
      if (!trip) {
        useTripStore.getState().selectTrip(null);
        return;
      }
      chooseTrip(trip.id);
      useSelectionStore.getState().initForTrip(trip, {});
    },
    [chooseTrip],
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
