import { StyleSheet, View } from 'react-native';

import type { FlightData } from '@/services/data/types';
import { spacing } from '@/theme';
import { Icon, Text } from '@/ui';

import { localLabels } from './flightInfo';

/**
 * Big airport codes with their cities and local departure and arrival times, shared by the flight
 * detail and the boarding pass. Each side shows its own airport's local time.
 */
export function FlightRoute({ flight, times = true }: { flight: FlightData; times?: boolean }) {
  const departs = localLabels(flight.departs);
  const arrives = localLabels(flight.arrives);
  return (
    <View style={styles.row}>
      <View style={styles.side} testID="flight-from">
        <Text variant="largeTitle">{flight.from.code}</Text>
        <Text variant="subhead" tone="secondary">
          {flight.from.city}
        </Text>
        {times ? (
          <>
            <Text variant="subhead" tone="secondary" style={styles.day}>
              {departs.day}
            </Text>
            <Text variant="title">{departs.time}</Text>
          </>
        ) : null}
      </View>
      <Icon name="airplane" size="lg" tone="secondary" style={styles.plane} />
      <View style={[styles.side, styles.end]} testID="flight-to">
        <Text variant="largeTitle">{flight.to.code}</Text>
        <Text variant="subhead" tone="secondary">
          {flight.to.city}
        </Text>
        {times ? (
          <>
            <Text variant="subhead" tone="secondary" style={styles.day}>
              {arrives.day}
            </Text>
            <Text variant="title">{arrives.time}</Text>
          </>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  side: { flex: 1, gap: spacing.xxs },
  end: { alignItems: 'flex-end' },
  plane: { marginTop: spacing.sm },
  day: { marginTop: spacing.md },
});
