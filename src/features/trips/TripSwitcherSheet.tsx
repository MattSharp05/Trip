import { Pressable, StyleSheet, View } from 'react-native';

import { now } from '@/core/clock';
import { dateRangeLabel } from '@/core/dates';
import { filterTrips } from '@/core/trips';
import { useTrips, type Trip } from '@/services/data';
import { useSelectionStore } from '@/stores/selection';
import { colors, spacing } from '@/theme';
import { Icon, Sheet, Skeleton, Text } from '@/ui';

import { useChooseTrip } from './selectedTrip';

export interface TripSwitcherSheetProps {
  open: boolean;
  onClose: () => void;
  /** The trip on screen; it gets the check. */
  currentTripId: string;
  testID?: string;
}

/**
 * The trip switcher (TR-15): upcoming trips, soonest first, then past ones. Choosing a trip selects
 * it for Plan, Organize and Discover (remembered on a real account) and opens Plan on its first
 * day, or today while it's underway.
 */
export function TripSwitcherSheet({
  open,
  onClose,
  currentTripId,
  testID = 'trip-switcher',
}: TripSwitcherSheetProps) {
  const { data: trips, isPending } = useTrips();
  const chooseTrip = useChooseTrip();

  const choose = (trip: Trip) => {
    if (trip.id !== currentTripId) {
      chooseTrip(trip.id);
      // A switch starts the trip fresh: its opening day, not a scenario's.
      useSelectionStore.getState().initForTrip(trip, {});
    }
    onClose();
  };

  const at = now();
  const groups = trips
    ? [
        { title: 'Upcoming', trips: filterTrips(trips, 'upcoming', at) },
        { title: 'Past', trips: filterTrips(trips, 'past', at) },
      ].filter((g) => g.trips.length > 0)
    : [];

  return (
    <Sheet open={open} onClose={onClose} title="Your trips">
      <View style={styles.groups} testID={testID}>
        {isPending ? (
          <View style={styles.group}>
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} height={52} radius="card" />
            ))}
          </View>
        ) : (
          groups.map((group) => (
            <View key={group.title} style={styles.group}>
              <Text variant="subhead" tone="secondary" accessibilityRole="header">
                {group.title}
              </Text>
              <View>
                {group.trips.map((trip, i) => (
                  <TripRow
                    key={trip.id}
                    trip={trip}
                    current={trip.id === currentTripId}
                    separator={i < group.trips.length - 1}
                    onPress={() => choose(trip)}
                    testID={`${testID}-${trip.id}`}
                  />
                ))}
              </View>
            </View>
          ))
        )}
      </View>
    </Sheet>
  );
}

interface TripRowProps {
  trip: Trip;
  current: boolean;
  separator: boolean;
  onPress: () => void;
  testID: string;
}

function TripRow({ trip, current, separator, onPress, testID }: TripRowProps) {
  const dates = dateRangeLabel(trip.startDate, trip.endDate);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${trip.city}, ${dates}`}
      accessibilityState={{ selected: current }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        separator && styles.separator,
        pressed && styles.pressed,
      ]}
      testID={testID}
    >
      <View style={styles.text}>
        <Text variant="body" style={styles.city} numberOfLines={1}>
          {trip.city}
        </Text>
        <Text variant="subhead" tone="secondary" numberOfLines={1}>
          {dates}
        </Text>
      </View>
      {current ? (
        <Icon name="checkmark" size="sm" weight="semibold" selected testID={`${testID}-check`} />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  groups: { gap: spacing.lg },
  group: { gap: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 52,
    paddingVertical: spacing.sm,
  },
  separator: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.hairline },
  pressed: { opacity: 0.6 },
  text: { flex: 1, gap: spacing.xxs },
  city: { fontWeight: '600' },
});
