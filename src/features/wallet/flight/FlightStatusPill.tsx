import { StyleSheet, View } from 'react-native';

import type { FlightData } from '@/services/data/types';
import { type FlightStatus, useFlightStatus } from '@/services/flightStatus';
import { colors, radii, spacing } from '@/theme';
import { Text } from '@/ui';

import { statusPill } from './status';

/** A status pill: tinted text on a raised capsule ("On time" green, problems orange). */
export function StatusPill({
  flight,
  status,
}: {
  flight: FlightData;
  status: FlightStatus | null;
}) {
  const pill = statusPill(flight, status);
  if (!pill) return null;
  return (
    <View
      style={styles.pill}
      accessibilityLabel={`Flight status: ${pill.label}`}
      testID="flight-status-pill"
    >
      <Text variant="caption" tone={pill.tone} style={styles.label} numberOfLines={1}>
        {pill.label}
      </Text>
    </View>
  );
}

/** The flight's live status pill, fetched on the day it flies; nothing otherwise. */
export function FlightStatusPill({ flight }: { flight: FlightData }) {
  const status = useFlightStatus(flight);
  return <StatusPill flight={flight} status={status} />;
}

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    backgroundColor: colors.fill,
  },
  label: { fontWeight: '600' },
});
