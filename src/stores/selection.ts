import { useEffect } from 'react';
import { create } from 'zustand';

import { now } from '@/core/clock';
import { dayIn, daysBetween } from '@/core/dates';
import type { Trip } from '@/services/data/types';

import { useScenarioStore, type ScenarioView } from './scenario';

/**
 * What the Plan tab has selected: one day of the trip and, optionally, one itinerary item. The map,
 * the date pills, the day header and (TR-17) the itinerary list all read and write it, so they
 * never disagree (TDD → Architecture). The trip itself is `useTripStore`.
 */
interface SelectionState {
  /** The trip the selection belongs to; a different trip starts a fresh selection. */
  tripId: string | null;
  /** `YYYY-MM-DD`, a day of the trip. */
  selectedDay: string | null;
  selectedItemId: string | null;
  /** Start a trip's selection on its opening day (see `openingDay`). */
  initForTrip: (trip: SelectionTrip) => void;
  selectDay: (day: string) => void;
  selectItem: (itemId: string | null) => void;
}

export type SelectionTrip = Pick<Trip, 'id' | 'startDate' | 'endDate' | 'timezone'>;

const within = (day: string, trip: SelectionTrip) =>
  daysBetween(trip.startDate, day) >= 0 && daysBetween(day, trip.endDate) >= 0;

/**
 * The day a trip opens on: the scenario's day when one asks for it, else today while the trip is
 * underway, else its first day.
 */
export function openingDay(trip: SelectionTrip, view: ScenarioView, instant: Date): string {
  if (view.day && within(view.day, trip)) return view.day;
  const today = dayIn(trip.timezone, instant);
  return within(today, trip) ? today : trip.startDate;
}

export const useSelectionStore = create<SelectionState>()((set) => ({
  tripId: null,
  selectedDay: null,
  selectedItemId: null,
  initForTrip: (trip) => {
    const { view } = useScenarioStore.getState();
    set({
      tripId: trip.id,
      selectedDay: openingDay(trip, view, now()),
      selectedItemId: view.itemId ?? null,
    });
  },
  // A new day clears the item: it belonged to the old day.
  selectDay: (selectedDay) => set({ selectedDay, selectedItemId: null }),
  selectItem: (selectedItemId) => set({ selectedItemId }),
}));

// Loading or leaving a scenario starts over: the next screen to show a trip re-initialises it.
useScenarioStore.subscribe((state, prev) => {
  if (state.view !== prev.view || state.active !== prev.active) {
    useSelectionStore.setState({ tripId: null, selectedDay: null, selectedItemId: null });
  }
});

/**
 * The selection for `trip`, initialising it when the trip first shows (or changes). Until the
 * store has caught up, it reports the opening day, so the first frame already shows the right day.
 */
export function useTripSelection(trip: SelectionTrip | undefined) {
  const state = useSelectionStore();
  const current = trip !== undefined && state.tripId === trip.id;

  useEffect(() => {
    if (trip && useSelectionStore.getState().tripId !== trip.id) {
      useSelectionStore.getState().initForTrip(trip);
    }
  }, [trip, current]);

  const view = useScenarioStore.getState().view;
  return {
    selectedDay: current ? state.selectedDay : trip ? openingDay(trip, view, now()) : null,
    selectedItemId: current ? state.selectedItemId : (view.itemId ?? null),
    selectDay: state.selectDay,
    selectItem: state.selectItem,
  };
}
