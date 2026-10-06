import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { tabTitle } from '@/core/tabs';
import { useScenarioStore } from '@/stores/scenario';
import { colors, screenPadding, spacing } from '@/theme';
import { Segmented, Text } from '@/ui';

import { BudgetSlot } from './BudgetSlot';
import { WalletList } from './WalletList';

type OrganizeView = 'wallet' | 'budget';

const SEGMENTS = [
  { value: 'wallet', label: 'Wallet' },
  { value: 'budget', label: 'Budget' },
] as const;

/** The Organize tab: a large title, the Wallet / Budget switch, and the selected view. */
export function OrganizeScreen() {
  const insets = useSafeAreaInsets();
  // A scenario can open the tab on either view; read once, on mount.
  const [view, setView] = useState<OrganizeView>(
    () => useScenarioStore.getState().view.organizeView ?? 'wallet',
  );

  return (
    <View style={[styles.screen, { paddingTop: insets.top + spacing.sm }]}>
      <View style={styles.header}>
        <Text variant="largeTitle" accessibilityRole="header">
          {tabTitle('organize')}
        </Text>
        <Segmented segments={SEGMENTS} value={view} onChange={setView} testID="organize-view" />
      </View>
      {view === 'wallet' ? <WalletList /> : <BudgetSlot />}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, gap: spacing.md, backgroundColor: colors.background },
  header: { gap: spacing.md, paddingHorizontal: screenPadding },
});
