import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { tabTitle } from '@/core/tabs';
import { TripTitle } from '@/features/trips/TripTitle';
import { useTripData } from '@/services/data';
import { useScenarioStore } from '@/stores/scenario';
import { useTripStore } from '@/stores/trip';
import { colors, screenPadding, spacing } from '@/theme';
import { Segmented, Skeleton, Text } from '@/ui';

import { BudgetSlot } from './BudgetSlot';
import { WalletList } from './WalletList';

type OrganizeView = 'wallet' | 'budget';

const SEGMENTS = [
  { value: 'wallet', label: 'Wallet' },
  { value: 'budget', label: 'Budget' },
] as const;

/**
 * The Organize tab: a large title over the trip title dropdown, the Wallet / Budget switch, and the
 * selected view.
 */
export function OrganizeScreen() {
  const insets = useSafeAreaInsets();
  // A scenario can open the tab on either view; read once, on mount.
  const [view, setView] = useState<OrganizeView>(
    () => useScenarioStore.getState().view.organizeView ?? 'wallet',
  );
  const tripId = useTripStore((s) => s.selectedTripId);
  const trip = useTripData(tripId).data?.trip;

  return (
    <View style={[styles.screen, { paddingTop: insets.top + spacing.sm }]}>
      <View style={styles.header}>
        <View style={styles.title}>
          <Text variant="largeTitle" accessibilityRole="header">
            {tabTitle('organize')}
          </Text>
          {trip ? (
            <TripTitle trip={trip} variant="inline" testID="organize-trip-title" />
          ) : tripId ? (
            <Skeleton width={200} height={18} testID="organize-trip-title-loading" />
          ) : null}
        </View>
        <Segmented segments={SEGMENTS} value={view} onChange={setView} testID="organize-view" />
      </View>
      {view === 'wallet' ? <WalletList /> : <BudgetSlot />}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, gap: spacing.md, backgroundColor: colors.background },
  header: { gap: spacing.md, paddingHorizontal: screenPadding },
  title: { gap: spacing.xxs },
});
