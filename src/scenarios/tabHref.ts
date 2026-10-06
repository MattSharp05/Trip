import type { TabName } from '@/core/tabs';

/** Route for each tab, typed for Expo Router. */
export const TAB_HREF = {
  trips: '/trips',
  plan: '/plan',
  organize: '/organize',
  discover: '/discover',
} as const satisfies Record<TabName, string>;
