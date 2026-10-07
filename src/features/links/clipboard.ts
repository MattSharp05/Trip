import * as Clipboard from 'expo-clipboard';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { create } from 'zustand';

interface ClipboardOffer {
  /** The clipboard held a link when the app last came to the foreground. */
  offered: boolean;
  dismiss: () => void;
}

/** Whether to show "Add this TikTok?" (Plan). Set by `useClipboardOffer` in the tab layout. */
export const useClipboardOfferStore = create<ClipboardOffer>()((set) => ({
  offered: false,
  dismiss: () => set({ offered: false }),
}));

/**
 * Each time the app comes to the foreground, asks iOS whether the clipboard holds a URL. That
 * question never reads the clipboard, so iOS shows no paste prompt; the text is read only when the
 * traveller taps the banner (`readClipboard`). Dismissing it lasts until the next foreground.
 */
export function useClipboardOffer() {
  useEffect(() => {
    let alive = true;
    const check = () => {
      Clipboard.hasUrlAsync()
        .then((has) => alive && useClipboardOfferStore.setState({ offered: has }))
        .catch(() => undefined);
    };
    check();
    let last = AppState.currentState;
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active' && last !== 'active') check();
      last = next;
    });
    return () => {
      alive = false;
      // Optional: some test environments' AppState returns no subscription.
      sub?.remove();
    };
  }, []);
}

/** Reads the clipboard's text: only ever after a tap (iOS asks to allow the paste). */
export async function readClipboard(): Promise<string> {
  try {
    return (await Clipboard.getStringAsync()) ?? '';
  } catch {
    return '';
  }
}
