import * as Brightness from 'expo-brightness';
import { useEffect } from 'react';

/**
 * Turns the screen to full brightness while the calling screen is open, so gate scanners read the
 * code, and puts the previous level back when it closes.
 */
export function useBrightnessBoost(): void {
  useEffect(() => {
    let previous: number | null = null;
    let closed = false;
    const boost = (async () => {
      previous = await Brightness.getBrightnessAsync();
      if (!closed) await Brightness.setBrightnessAsync(1);
    })().catch(() => {});

    return () => {
      closed = true;
      // After the boost settles, so a slow boost can't land after the restore.
      void boost.then(() =>
        previous === null ? undefined : Brightness.setBrightnessAsync(previous).catch(() => {}),
      );
    };
  }, []);
}
