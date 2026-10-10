import { create } from 'zustand';

interface TripState {
  selectedTripId: string | null;
  /**
   * Discover shows every upcoming trip instead of the selected one (TR-33). Its own flag, so Plan
   * and Organize keep their trip while Discover looks across all of them.
   */
  discoverAll: boolean;
  /**
   * Counts trips opened from a card, a globe dot or the switcher (TR-56): each one brings Plan's
   * sheet back to half height, so the map shows.
   */
  opens: number;
  selectTrip: (tripId: string | null) => void;
  setDiscoverAll: (discoverAll: boolean) => void;
  countOpen: () => void;
}

/** The trip the Plan, Organize and Discover tabs show. */
export const useTripStore = create<TripState>()((set) => ({
  selectedTripId: null,
  discoverAll: false,
  opens: 0,
  selectTrip: (selectedTripId) => set({ selectedTripId }),
  setDiscoverAll: (discoverAll) => set({ discoverAll }),
  countOpen: () => set((s) => ({ opens: s.opens + 1 })),
}));
