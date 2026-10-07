import { StyleSheet, View } from 'react-native';

import { TripTitle } from '@/features/trips/TripTitle';
import type { Trip } from '@/services/data/types';
import { spacing } from '@/theme';
import { IconButton } from '@/ui';

export interface PlanHeaderProps {
  trip: Pick<Trip, 'id' | 'city' | 'startDate' | 'endDate'>;
  onMorePress?: () => void;
}

/**
 * The Plan header: the trip title dropdown (city, chevron, dates; opens the trip switcher), centred,
 * and a "more" button.
 */
export function PlanHeader({ trip, onMorePress }: PlanHeaderProps) {
  return (
    <View style={styles.bar} testID="plan-header">
      <View style={styles.side} />
      <View style={styles.title}>
        <TripTitle trip={trip} testID="plan-trip-title" />
      </View>
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
});
