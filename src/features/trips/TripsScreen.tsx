import { useRouter } from 'expo-router';
import { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import { useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { now } from '@/core/clock';
import { mapAreaHeight } from '@/core/sheet';
import { filterTrips, type TripFilter } from '@/core/trips';
import { MapSheet } from '@/features/map/MapSheet';
import { useTrips, type Trip } from '@/services/data';
import { colors, radii, screenPadding, spacing } from '@/theme';
import { Button, IconButton, Segmented, Skeleton, Text } from '@/ui';

import { useChooseTrip, useRestoreSelectedTrip } from './selectedTrip';
import { TRIP_CARD_HEIGHT, TripCard } from './TripCard';
import { TripsGlobe } from './TripsGlobe';

const SEGMENTS = [
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'past', label: 'Past' },
  { value: 'all', label: 'All' },
] as const;

/** Share of the screen the globe shows above the half-height sheet (as Plan's map). */
const GLOBE_SHARE = 0.36;
/** The sheet's rounded top overlaps the globe by its corner radius. */
const SHEET_OVERLAP = radii.photo;
/** The title row, until the body under it has been measured. */
const TOP_ESTIMATE = 72;
/** The native tab bar floats over the bottom of the screen (iOS 26), as on Plan. */
const FLOATING_TAB_BAR = 64;

const EMPTY_FILTER: Record<TripFilter, string> = {
  upcoming: 'No upcoming trips.',
  past: 'No past trips yet.',
  all: 'No trips yet.',
};

/**
 * The Trips tab (TR-10): My Trips, a globe with the shown trips' dots (TR-16), Upcoming / Past /
 * All, a photo card per trip. Tapping a card or a dot selects the trip and opens Plan; `+` creates
 * one; the profile button opens Settings.
 */
export function TripsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { height } = useWindowDimensions();
  const { data: trips, isPending, isError, refetch } = useTrips();
  const [filter, setFilter] = useState<TripFilter>('upcoming');
  const chooseTrip = useChooseTrip();
  useRestoreSelectedTrip(trips);

  const create = () => router.push('/trips/new');
  const open = (trip: Trip) => {
    chooseTrip(trip.id);
    router.navigate('/plan');
  };

  const hasTrips = !!trips && trips.length > 0;

  // The globe fills the space the list's sheet leaves: drag the sheet down to see all of it
  // (TR-46 QA round 2).
  const [bodyHeight, setBodyHeight] = useState(() => height - insets.top - TOP_ESTIMATE);
  const globeHalf = Math.round(height * GLOBE_SHARE);
  const sheetHalf = Math.max(bodyHeight - globeHalf + SHEET_OVERLAP, 0);
  const [sheetCover, setSheetCover] = useState<number | null>(null);
  const globeHeight = mapAreaHeight(bodyHeight, sheetCover ?? sheetHalf, SHEET_OVERLAP);
  const sheetBottom = insets.bottom + FLOATING_TAB_BAR;
  const shown = trips ? filterTrips(trips, filter, now()) : [];

  let body;
  if (isPending) {
    body = (
      <View style={styles.list} testID="trips-loading">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} height={TRIP_CARD_HEIGHT} radius="photo" />
        ))}
      </View>
    );
  } else if (isError) {
    body = (
      <View style={styles.message}>
        <Text variant="body" tone="secondary">
          Couldn&apos;t load your trips.
        </Text>
        <Button label="Try again" variant="secondary" onPress={() => void refetch()} />
      </View>
    );
  } else if (!hasTrips) {
    body = (
      <View style={styles.empty} testID="trips-empty">
        <Text variant="title">Plan your first trip</Text>
        <Text variant="body" tone="secondary" style={styles.center}>
          Add where you&apos;re going and when. Bookings, plans and events follow from there.
        </Text>
        <Button label="Create a trip" icon="plus" onPress={create} testID="trips-empty-create" />
      </View>
    );
  } else {
    body = (
      <BottomSheetFlatList
        data={shown}
        keyExtractor={(trip: Trip) => trip.id}
        renderItem={({ item }: { item: Trip }) => (
          <TripCard trip={item} onPress={() => open(item)} />
        )}
        contentContainerStyle={[styles.list, { paddingBottom: sheetBottom + spacing.lg }]}
        ListEmptyComponent={
          <Text variant="body" tone="secondary" style={styles.center}>
            {EMPTY_FILTER[filter]}
          </Text>
        }
        testID="trips-list"
      />
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top + spacing.sm }]}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text variant="largeTitle" accessibilityRole="header" style={styles.title}>
            My Trips
          </Text>
          <IconButton
            icon="person.crop.circle"
            label="Settings"
            variant="plain"
            size="lg"
            onPress={() => router.push('/settings')}
            testID="trips-settings"
          />
          <IconButton
            icon="plus"
            label="Create a trip"
            variant="filled"
            onPress={create}
            testID="trips-create"
          />
        </View>
      </View>
      {hasTrips ? (
        <View style={styles.body} onLayout={(e) => setBodyHeight(e.nativeEvent.layout.height)}>
          <TripsGlobe trips={shown} onOpen={open} height={globeHeight} />
          <MapSheet
            halfHeight={sheetHalf}
            bottomInset={sheetBottom}
            onCoverChange={setSheetCover}
            top={
              <View style={styles.filter}>
                <Segmented
                  segments={SEGMENTS}
                  value={filter}
                  onChange={setFilter}
                  testID="trips-filter"
                />
              </View>
            }
            testID="trips-sheet"
          >
            {body}
          </MapSheet>
        </View>
      ) : (
        body
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, gap: spacing.md, backgroundColor: colors.background },
  title: { flex: 1 },
  header: { gap: spacing.md, paddingHorizontal: screenPadding },
  body: { flex: 1 },
  filter: { paddingHorizontal: screenPadding, paddingBottom: spacing.md },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  list: { gap: spacing.md, paddingHorizontal: screenPadding },
  message: { alignItems: 'center', gap: spacing.md, padding: screenPadding },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xxxl,
    paddingBottom: spacing.xxxl * 2,
  },
  center: { textAlign: 'center' },
});
