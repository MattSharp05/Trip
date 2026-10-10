import { StyleSheet, View } from 'react-native';

import { MemberAvatars } from '@/features/members';
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
 * then on the right the trip's members (TR-56) and a "more" button.
 */
export function PlanHeader({ trip, onMorePress }: PlanHeaderProps) {
  return (
    <View style={styles.bar} testID="plan-header">
      <View style={styles.side} />
      <View style={styles.title}>
        <TripTitle trip={trip} testID="plan-trip-title" />
      </View>
      <View style={[styles.side, styles.end]}>
        <MemberAvatars tripId={trip.id} testID="plan-members" />
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
  // Equal sides keep the title centred, whatever the avatars take on the right.
  side: { flex: 1, flexBasis: 0, minWidth: 44 },
  end: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: spacing.xs },
  title: { flexShrink: 1, alignItems: 'center' },
});
