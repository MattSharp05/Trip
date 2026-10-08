import { initialWindowMetrics, useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Height the native tab bar takes above the home indicator, plus a little air (iOS 26: the
 * floating Liquid Glass bar's top sits about 48 pt above the bottom safe area).
 */
export const FLOATING_TAB_BAR = 64;

/**
 * How far from the bottom of a tab screen content must stay to be clear of the floating tab bar:
 * the last row of a scroll view (as bottom padding) and a toast (as its `bottom`).
 *
 * The tab bar floats over the screen, and a React Native ScrollView doesn't inset for it (its
 * `contentInsetAdjustmentBehavior` is `never`), so every tab screen pads for it itself. The
 * window's own bottom inset (the home indicator) is the base; the larger of the two wins, so it
 * stays right whether or not the tab's safe area already includes the bar.
 */
export function useTabBarInset(): number {
  const insets = useSafeAreaInsets();
  const home = initialWindowMetrics?.insets.bottom ?? insets.bottom;
  return Math.max(insets.bottom, home + FLOATING_TAB_BAR);
}
