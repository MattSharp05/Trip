import { create } from 'zustand';

import type { BucketSort } from '@/core/bucket';

/** What a scenario asks the screens to open on. Screens read it once when they mount. */
export interface ScenarioView {
  /** Plan: the day to show (`YYYY-MM-DD`) and the item to highlight. */
  day?: string;
  itemId?: string;
  /** Plan: open the detail sheet of `itemId` (TR-60). */
  openDetails?: boolean;
  /** Plan: itinerary or Bucket List. */
  planMode?: 'itinerary' | 'bucket';
  /** Plan: the Bucket List's order (TR-59); Recent when unset. */
  bucketSort?: BucketSort;
  /** Organize: Wallet or Budget, and the currency budgets display in. */
  organizeView?: 'wallet' | 'budget';
  /** Organize → Wallet on a group trip: Mine or Shared (TR-61). */
  walletScope?: 'mine' | 'shared';
  /** Organize → Expenses: the segment to open (TR-65); Categories when unset. */
  budgetTab?: 'categories' | 'expenses' | 'balances';
  currency?: string;
  /**
   * Organize: open the import review screen on a sample booking (a fixture parse; see
   * supabase/functions/_shared/parse/fixtures.ts), or `not-configured` for the no-key state.
   */
  importSample?: 'flight' | 'hotel' | 'car' | 'restaurant' | 'lisbon-hotel' | 'not-configured';
  /**
   * Plan: open the results sheet on a sample video (supabase/functions/_shared/parse/linkFixtures.ts),
   * as if its link had been pasted.
   */
  linkSample?: 'vegas-food' | 'instagram-sunset';
  /** Discover: every upcoming trip instead of the selected one. */
  discoverAll?: boolean;
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
