import { useState } from 'react';

import { openOriginal } from '../flight/actions';
import { openLink } from './links';

/** Opening links and the original file from a detail screen, with a toast when it fails. */
export function useLinkActions() {
  const [toast, setToast] = useState<string | null>(null);

  const open = async (url: string) => {
    if (!(await openLink(url))) setToast("Couldn't open that on this phone");
  };

  const viewOriginal = async (path: string) => {
    try {
      await openOriginal(path);
    } catch {
      setToast("Couldn't open the original booking");
    }
  };

  return { toast, dismissToast: () => setToast(null), open, viewOriginal };
}
