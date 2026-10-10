import { create } from 'zustand';

import { type DataSource, supabaseSource } from './source';

interface ActiveSourceState {
  source: DataSource;
  setSource: (source: DataSource) => void;
}

/** The data source every hook reads: Supabase unless a scenario put a demo session in place. */
export const useActiveSource = create<ActiveSourceState>()((set) => ({
  source: supabaseSource,
  setSource: (source) => set({ source }),
}));

export function useDataSource(): DataSource {
  return useActiveSource((s) => s.source);
}
