import { Pressable, StyleSheet, View } from 'react-native';

import { now } from '@/core/clock';
import { dateRangeLabel } from '@/core/dates';
import { filterTrips } from '@/core/trips';
import { useTrips, type Trip } from '@/services/data';
import { useSelectionStore } from '@/stores/selection';
import { colors, spacing } from '@/theme';
import { Icon, Sheet, Skeleton, Text } from '@/ui';

import { useChooseTrip } from './selectedTrip';

/** Discover's extra choice (TR-33): every upcoming trip at once instead of one. */
export interface AllUpcomingOption {
  /** It's the current choice: its row gets the check, not the trip's. */
  selected: boolean;
  /** Called with true when it's chosen, false when a trip is. */
  onChange: (selected: boolean) => void;
}

export interface TripSwitcherSheetProps {
  open: boolean;
  onClose: () => void;
  /** The trip on screen; it gets the check. */
  currentTripId: string;
  allUpcoming?: AllUpcomingOption;
  testID?: string;
}

/**
 * The trip switcher (TR-15): upcoming trips, soonest first, then past ones. Choosing a trip selects
 * it for Plan, Organize and Discover (remembered on a real account) and opens Plan on its first
 * day, or today while it's underway. Discover adds "All upcoming trips" at the top (TR-33).
 */
export function TripSwitcherSheet({
  open,
  onClose,
  currentTripId,
  allUpcoming,
  testID = 'trip-switcher',
}: TripSwitcherSheetProps) {
  const { data: trips, isPending } = useTrips();
  const chooseTrip = useChooseTrip();

  const choose = (trip: Trip) => {
    allUpcoming?.onChange(false);
    if (trip.id !== currentTripId) {
      chooseTrip(trip.id);
      // A switch starts the trip fresh: its opening day, not a scenario's.
      useSelectionStore.getState().initForTrip(trip, {});
    }
    onClose();
  };

  const chooseAll = () => {
    allUpcoming?.onChange(true);
    onClose();
  };

  const at = now();
  const upcoming = trips ? filterTrips(trips, 'upcoming', at) : [];
  const groups = trips
    ? [
        { title: 'Upcoming', trips: upcoming },
        { title: 'Past', trips: filterTrips(trips, 'past', at) },
      ].filter((g) => g.trips.length > 0)
    : [];
  const all = allUpcoming?.selected === true;

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
                {allUpcoming && group.title === 'Upcoming' ? (
                  <Row
                    title="All upcoming trips"
                    subtitle={upcoming.map((t) => t.city).join(', ')}
                    current={all}
                    separator
                    onPress={chooseAll}
                    testID={`${testID}-all`}
                  />
                ) : null}
                {group.trips.map((trip, i) => (
                  <TripRow
                    key={trip.id}
                    trip={trip}
                    current={!all && trip.id === currentTripId}
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

function TripRow({ trip, ...rest }: TripRowProps) {
  return (
    <Row title={trip.city} subtitle={dateRangeLabel(trip.startDate, trip.endDate)} {...rest} />
  );
}

interface RowProps extends Omit<TripRowProps, 'trip'> {
  title: string;
  subtitle: string;
}

function Row({ title, subtitle, current, separator, onPress, testID }: RowProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${subtitle}`}
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
          {title}
        </Text>
        <Text variant="subhead" tone="secondary" numberOfLines={1}>
          {subtitle}
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
