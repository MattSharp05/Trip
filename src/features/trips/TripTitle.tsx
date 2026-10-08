import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { dateRangeLabel } from '@/core/dates';
import type { Trip } from '@/services/data/types';
import { spacing } from '@/theme';
import { Icon, Text } from '@/ui';

import { TripSwitcherSheet, type AllUpcomingOption } from './TripSwitcherSheet';

export interface TripTitleProps {
  trip: Pick<Trip, 'id' | 'city' | 'startDate' | 'endDate'>;
  /**
   * `center`: the city with a chevron over the dates, for a navigation bar (Plan). `inline`: one
   * line under a large title, "Las Vegas · Nov 12 – Nov 16, 2026" (Organize, Discover): the city
   * in headline type, the dates in secondary body type.
   */
  variant?: 'center' | 'inline';
  /**
   * Discover (TR-33): the switcher also offers "All upcoming trips", and while it's chosen the
   * line reads "All upcoming trips" instead of the trip.
   */
  allUpcoming?: AllUpcomingOption;
  testID?: string;
}

/**
 * The trip a tab shows, as its title dropdown (TR-15). Tapping it opens the trip switcher. Shared
 * by the Plan, Organize and Discover headers.
 */
export function TripTitle({
  trip,
  variant = 'center',
  allUpcoming,
  testID = 'trip-title',
}: TripTitleProps) {
  const [open, setOpen] = useState(false);
  // The sheet mounts on the first tap and stays, so closing it still animates.
  const [used, setUsed] = useState(false);
  const dates = dateRangeLabel(trip.startDate, trip.endDate);
  const all = allUpcoming?.selected === true;

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={all ? ALL_UPCOMING : `${trip.city}, ${dates}`}
        accessibilityHint="Switch trips"
        onPress={() => {
          setUsed(true);
          setOpen(true);
        }}
        style={({ pressed }) => [
          variant === 'center' ? styles.center : styles.inline,
          pressed && styles.pressed,
        ]}
        hitSlop={spacing.sm}
        testID={testID}
      >
        {variant === 'center' ? (
          <>
            <View style={styles.row}>
              <Text variant="headline">{all ? ALL_UPCOMING : trip.city}</Text>
              <Icon name="chevron.down" size="sm" weight="semibold" />
            </View>
            {all ? null : (
              <Text variant="caption" tone="secondary">
                {dates}
              </Text>
            )}
          </>
        ) : (
          <>
            {/* TR-48: headline size with the trip in primary text, so it reads as the screen's
                trip and not a footnote; the dates stay secondary. */}
            <Text variant="headline" numberOfLines={1} style={styles.shrink}>
              {all ? ALL_UPCOMING : trip.city}
              {all ? null : <Text variant="body" tone="secondary">{` · ${dates}`}</Text>}
            </Text>
            <Icon name="chevron.down" size="sm" weight="semibold" />
          </>
        )}
      </Pressable>
      {used ? (
        <TripSwitcherSheet
          open={open}
          onClose={() => setOpen(false)}
          currentTripId={trip.id}
          allUpcoming={allUpcoming}
          testID={`${testID}-switcher`}
        />
      ) : null}
    </>
  );
}

const ALL_UPCOMING = 'All upcoming trips';

const styles = StyleSheet.create({
  center: { alignItems: 'center' },
  inline: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  shrink: { flexShrink: 1 },
  pressed: { opacity: 0.6 },
});
