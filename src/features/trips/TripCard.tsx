import { StyleSheet, View } from 'react-native';

import { dateRangeLabel } from '@/core/dates';
import type { Trip } from '@/services/data';
import { spacing } from '@/theme';
import { PhotoCard } from '@/ui';

import { PhotoCreditLine } from './PhotoCreditLine';

export const TRIP_CARD_HEIGHT = 132;

/** One trip in My Trips: cover photo (or the plain surface), city, dates, chevron. */
export function TripCard({ trip, onPress }: { trip: Trip; onPress: () => void }) {
  return (
    <View style={styles.card}>
      <PhotoCard
        source={trip.coverPhotoUrl ? { uri: trip.coverPhotoUrl } : null}
        title={trip.city}
        subtitle={dateRangeLabel(trip.startDate, trip.endDate)}
        height={TRIP_CARD_HEIGHT}
        onPress={onPress}
        testID={`trip-card-${trip.id}`}
      />
      {trip.coverPhotoCredit ? (
        <PhotoCreditLine credit={trip.coverPhotoCredit} testID={`trip-credit-${trip.id}`} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.xs },
});
