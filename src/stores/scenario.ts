import { create } from 'zustand';

/** What a scenario asks the screens to open on. Screens read it once when they mount. */
export interface ScenarioView {
  /** Plan: the day to show (`YYYY-MM-DD`) and the item to highlight. */
  day?: string;
  itemId?: string;
  /** Plan: itinerary or Bucket List. */
  planMode?: 'itinerary' | 'bucket';
  /** Organize: Wallet or Budget, and the currency budgets display in. */
  organizeView?: 'wallet' | 'budget';
  currency?: string;
}

interface ScenarioState {
  /** The loaded scenario's name; null for a real account. */
  active: string | null;
  view: ScenarioView;
  start: (name: string, view: ScenarioView) => void;
  clear: () => void;
}

/** The demo session started by a scenario link or the /dev index. */
export const useScenarioStore = create<ScenarioState>()((set) => ({
  active: null,
  view: {},
  start: (active, view) => set({ active, view }),
  clear: () => set({ active: null, view: {} }),
}));
