import type { SFSymbol } from 'expo-symbols';

import { colors } from '@/theme/colors';

export type TabName = 'trips' | 'plan' | 'organize' | 'discover';

export interface TabDefinition {
  name: TabName;
  title: string;
  icon: SFSymbol;
}

/** The app's four tabs, in tab-bar order. */
export const TABS: readonly TabDefinition[] = [
  { name: 'trips', title: 'Trips', icon: 'suitcase' },
  { name: 'plan', title: 'Plan', icon: 'mappin.and.ellipse' },
  { name: 'organize', title: 'Organize', icon: 'wallet.pass' },
  { name: 'discover', title: 'Discover', icon: 'safari' },
];

/** Tint for the selected tab (design.md accent). */
export const TAB_TINT = colors.accent;

export function tabTitle(name: TabName): string {
  const tab = TABS.find((t) => t.name === name);
  if (!tab) throw new Error(`Unknown tab: ${name}`);
  return tab.title;
}
