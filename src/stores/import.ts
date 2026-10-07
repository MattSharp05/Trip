import { create } from 'zustand';

import type { PickedFile } from '@/services/parseBooking';

interface ImportState {
  /** The file the review screen reads; set before it opens. */
  file: PickedFile | null;
  /** The confirmation Organize shows once, after a save. */
  savedMessage: string | null;
  start: (file: PickedFile) => void;
  saved: (message: string) => void;
  clearMessage: () => void;
}

/** Booking import (TR-25): hands the picked file to the review screen and the toast back. */
export const useImportStore = create<ImportState>()((set) => ({
  file: null,
  savedMessage: null,
  start: (file) => set({ file }),
  saved: (savedMessage) => set({ savedMessage, file: null }),
  clearMessage: () => set({ savedMessage: null }),
}));
