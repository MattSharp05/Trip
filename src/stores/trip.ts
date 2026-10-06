import { create } from 'zustand';

interface TripState {
  selectedTripId: string | null;
  selectTrip: (tripId: string | null) => void;
}

/** The trip the Plan, Organize and Discover tabs show. */
export const useTripStore = create<TripState>()((set) => ({
  selectedTripId: null,
  selectTrip: (selectedTripId) => set({ selectedTripId }),
}));
