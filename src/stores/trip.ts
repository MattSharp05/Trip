import { create } from 'zustand';

interface TripState {
  selectedTripId: string | null;
  /**
   * Discover shows every upcoming trip instead of the selected one (TR-33). Its own flag, so Plan
   * and Organize keep their trip while Discover looks across all of them.
   */
  discoverAll: boolean;
  selectTrip: (tripId: string | null) => void;
  setDiscoverAll: (discoverAll: boolean) => void;
}

/** The trip the Plan, Organize and Discover tabs show. */
export const useTripStore = create<TripState>()((set) => ({
  selectedTripId: null,
  discoverAll: false,
  selectTrip: (selectedTripId) => set({ selectedTripId }),
  setDiscoverAll: (discoverAll) => set({ discoverAll }),
}));
