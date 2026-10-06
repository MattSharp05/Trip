import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * True while iOS Settings → Accessibility → Motion → Reduce Motion is on; `undefined` until the
 * setting has been read (start motion only once this is `false`).
 */
export function useReduceMotion(): boolean | undefined {
  const [reduceMotion, setReduceMotion] = useState<boolean>();

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduceMotion(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  return reduceMotion;
}
