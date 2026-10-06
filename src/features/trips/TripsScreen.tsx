import { useRouter } from 'expo-router';
import { useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { now } from '@/core/clock';
import { filterTrips, type TripFilter } from '@/core/trips';
import { useTrips, type Trip } from '@/services/data';
import { colors, screenPadding, spacing } from '@/theme';
import { Button, IconButton, Segmented, Skeleton, Text } from '@/ui';

import { useChooseTrip, useRestoreSelectedTrip } from './selectedTrip';
import { TRIP_CARD_HEIGHT, TripCard } from './TripCard';

const SEGMENTS = [
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'past', label: 'Past' },
  { value: 'all', label: 'All' },
] as const;

const EMPTY_FILTER: Record<TripFilter, string> = {
  upcoming: 'No upcoming trips.',
  past: 'No past trips yet.',
  all: 'No trips yet.',
};

/**
 * The Trips tab (TR-10): My Trips, Upcoming / Past / All, a photo card per trip. Tapping a card
 * selects the trip and opens Plan; `+` creates one; the profile button opens Settings.
 */
export function TripsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
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
      <FlatList
        data={shown}
        keyExtractor={(trip) => trip.id}
        renderItem={({ item }) => <TripCard trip={item} onPress={() => open(item)} />}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + spacing.xxxl }]}
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
        {hasTrips ? (
          <Segmented
            segments={SEGMENTS}
            value={filter}
            onChange={setFilter}
            testID="trips-filter"
          />
        ) : null}
      </View>
      {body}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, gap: spacing.md, backgroundColor: colors.background },
  title: { flex: 1 },
  header: { gap: spacing.md, paddingHorizontal: screenPadding },
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
