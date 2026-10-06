import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { dateRangeLabel } from '@/core/dates';
import type { Trip } from '@/services/data/types';
import { spacing } from '@/theme';
import { Icon, Text } from '@/ui';

import { TripSwitcherSheet } from './TripSwitcherSheet';

export interface TripTitleProps {
  trip: Pick<Trip, 'id' | 'city' | 'startDate' | 'endDate'>;
  /**
   * `center`: the city with a chevron over the dates, for a navigation bar (Plan). `inline`: one
   * line under a large title, "Las Vegas · Nov 12 – Nov 16, 2026" (Organize, Discover).
   */
  variant?: 'center' | 'inline';
  testID?: string;
}

/**
 * The trip a tab shows, as its title dropdown (TR-15). Tapping it opens the trip switcher. Shared
 * by the Plan, Organize and Discover headers.
 */
export function TripTitle({ trip, variant = 'center', testID = 'trip-title' }: TripTitleProps) {
  const [open, setOpen] = useState(false);
  // The sheet mounts on the first tap and stays, so closing it still animates.
  const [used, setUsed] = useState(false);
  const dates = dateRangeLabel(trip.startDate, trip.endDate);

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${trip.city}, ${dates}`}
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
              <Text variant="headline">{trip.city}</Text>
              <Icon name="chevron.down" size="sm" weight="semibold" />
            </View>
            <Text variant="caption" tone="secondary">
              {dates}
            </Text>
          </>
        ) : (
          <>
            <Text variant="subhead" tone="secondary" numberOfLines={1} style={styles.shrink}>
              {`${trip.city} · ${dates}`}
            </Text>
            <Icon name="chevron.down" size="sm" tone="secondary" weight="semibold" />
          </>
        )}
      </Pressable>
      {used ? (
        <TripSwitcherSheet
          open={open}
          onClose={() => setOpen(false)}
          currentTripId={trip.id}
          testID={`${testID}-switcher`}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center' },
  inline: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  shrink: { flexShrink: 1 },
  pressed: { opacity: 0.6 },
});
