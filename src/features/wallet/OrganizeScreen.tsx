import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { tabTitle } from '@/core/tabs';
import { AddBookingSheet } from '@/features/import';
import { MemberAvatars } from '@/features/members';
import { TripTitle } from '@/features/trips/TripTitle';
import { useTripData } from '@/services/data';
import { useImportStore } from '@/stores/import';
import { useScenarioStore } from '@/stores/scenario';
import { useTripStore } from '@/stores/trip';
import { colors, screenPadding, spacing } from '@/theme';
import { IconButton, Segmented, Skeleton, Text, Toast } from '@/ui';

import { BudgetSlot } from './BudgetSlot';
import { WalletList } from './WalletList';

type OrganizeView = 'wallet' | 'budget';

const SEGMENTS = [
  { value: 'wallet', label: 'Wallet' },
  { value: 'budget', label: 'Budget' },
] as const;

/**
 * The Organize tab: a large title (with the orange `+` that imports a booking) over the trip title
 * dropdown, the Wallet / Budget switch, and the selected view.
 */
export function OrganizeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const savedMessage = useImportStore((s) => s.savedMessage);
  const clearMessage = useImportStore((s) => s.clearMessage);
  // A scenario can open the tab on either view; read once, on mount.
  const [view, setView] = useState<OrganizeView>(
    () => useScenarioStore.getState().view.organizeView ?? 'wallet',
  );
  const tripId = useTripStore((s) => s.selectedTripId);
  const trip = useTripData(tripId).data?.trip;

  // A scenario can open straight on the review screen with one of the sample bookings.
  useEffect(() => {
    const { view: scenarioView } = useScenarioStore.getState();
    const sample = scenarioView.importSample;
    if (!sample) return;
    // Once per scenario load, even when the screen mounts again.
    useScenarioStore.setState({ view: { ...scenarioView, importSample: undefined } });
    const ext = sample.endsWith('screenshot') ? 'png' : 'pdf';
    useImportStore.getState().start({
      uri: `fixture:${sample}`,
      name: `${sample}.${ext}`,
      mimeType: ext === 'png' ? 'image/png' : 'application/pdf',
    });
    router.push('/organize/import');
  }, [router]);

  return (
    <View style={[styles.screen, { paddingTop: insets.top + spacing.sm }]}>
      <View style={styles.header}>
        <View style={styles.title}>
          <View style={styles.titleRow}>
            <Text variant="largeTitle" accessibilityRole="header">
              {tabTitle('organize')}
            </Text>
            <IconButton
              icon="plus"
              label="Add a booking"
              variant="filled"
              onPress={() => setAdding(true)}
              testID="organize-add"
            />
          </View>
          {trip ? (
            <View style={styles.tripRow}>
              <View style={styles.tripTitle}>
                <TripTitle trip={trip} variant="inline" testID="organize-trip-title" />
              </View>
              <MemberAvatars tripId={trip.id} testID="organize-members" />
            </View>
          ) : tripId ? (
            <Skeleton width={220} height={22} testID="organize-trip-title-loading" />
          ) : null}
        </View>
        <Segmented segments={SEGMENTS} value={view} onChange={setView} testID="organize-view" />
      </View>
      {view === 'wallet' ? <WalletList /> : <BudgetSlot />}
      <AddBookingSheet open={adding} onClose={() => setAdding(false)} />
      <Toast
        visible={savedMessage !== null}
        message={savedMessage ?? ''}
        onDismiss={clearMessage}
        duration={6000}
        testID="organize-toast"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, gap: spacing.md, backgroundColor: colors.background },
  header: { gap: spacing.md, paddingHorizontal: screenPadding },
  title: { gap: spacing.xxs },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  // The trip line with its members on the right (TR-56); a long city shortens, not the avatars.
  tripRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  tripTitle: { flexShrink: 1 },
});
