import { Pressable, StyleSheet, View } from 'react-native';

import { dateRangeLabel } from '@/core/dates';
import type { Trip } from '@/services/data/types';
import { spacing } from '@/theme';
import { Icon, IconButton, Text } from '@/ui';

export interface PlanHeaderProps {
  trip: Pick<Trip, 'city' | 'startDate' | 'endDate'>;
  /** TR-15 opens the trip switcher here. */
  onTitlePress?: () => void;
  onMorePress?: () => void;
}

/**
 * The Plan header: the trip's city with a chevron and its dates, centred, and a "more" button. A
 * plain title for now; TR-15 replaces it with the trip switcher.
 */
export function PlanHeader({ trip, onTitlePress, onMorePress }: PlanHeaderProps) {
  const dates = dateRangeLabel(trip.startDate, trip.endDate);
  return (
    <View style={styles.bar} testID="plan-header">
      <View style={styles.side} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${trip.city}, ${dates}`}
        accessibilityHint="Switch trips"
        onPress={onTitlePress}
        style={styles.title}
        testID="plan-trip-title"
      >
        <View style={styles.city}>
          <Text variant="headline">{trip.city}</Text>
          <Icon name="chevron.down" size="sm" weight="semibold" />
        </View>
        <Text variant="caption" tone="secondary">
          {dates}
        </Text>
      </Pressable>
      <View style={[styles.side, styles.end]}>
        <IconButton icon="ellipsis" label="More" variant="plain" onPress={onMorePress} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  side: { width: 44 },
  end: { alignItems: 'flex-end' },
  title: { flex: 1, alignItems: 'center' },
  city: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
});
