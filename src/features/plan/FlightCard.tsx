import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { dayLabel, timeLabel } from '@/core/dates';
import type { FlightData, LocalDateTime } from '@/services/data/types';
import { colors, continuous, radii, screenPadding, spacing } from '@/theme';
import { Icon, Text } from '@/ui';

const BADGE = 28;

export interface FlightCardProps {
  flight: FlightData;
  /** Opens the flight's details. */
  onPress: () => void;
  /**
   * The slot at the card's top right for the flight's live status pill (TR-26). Empty until then.
   */
  status?: ReactNode;
}

/**
 * The flight under the globe on a travel day, like a seatback screen (reference mockup, screen 3):
 * the flight number, big airport codes with their cities, and each airport's local time and date.
 * Tapping it opens the flight's details.
 */
export function FlightCard({ flight, onPress, status }: FlightCardProps) {
  return (
    <View style={styles.outer}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${flight.flightNumber}, ${flight.from.city} to ${flight.to.city}, details`}
        onPress={onPress}
        testID="flight-card"
        style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      >
        <View style={styles.top}>
          <View style={styles.badge}>
            <Text variant="caption" style={styles.code}>
              {flight.airlineCode}
            </Text>
          </View>
          <Text variant="headline" style={styles.number}>
            {flight.flightNumber}
          </Text>
          <View style={styles.status} testID="flight-card-status">
            {status}
          </View>
        </View>
        <View style={styles.route}>
          <End code={flight.from.code} city={flight.from.city} at={flight.departs} />
          <Icon name="airplane" tone="secondary" style={styles.plane} />
          <End code={flight.to.code} city={flight.to.city} at={flight.arrives} alignEnd />
        </View>
      </Pressable>
    </View>
  );
}

/** One airport: its code, city, and the local time and date there. */
function End({
  code,
  city,
  at,
  alignEnd = false,
}: {
  code: string;
  city: string;
  at: LocalDateTime;
  alignEnd?: boolean;
}) {
  return (
    <View style={[styles.end, alignEnd && styles.alignEnd]}>
      <Text variant="largeTitle">{code}</Text>
      <Text variant="subhead" tone="secondary" numberOfLines={1}>
        {city}
      </Text>
      <Text variant="subhead" tone="secondary" numberOfLines={1}>
        <Text variant="subhead" style={styles.time}>
          {timeLabel(at.time)}
        </Text>
        {` · ${dayLabel(at.date)}`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { paddingHorizontal: screenPadding, paddingBottom: spacing.sm },
  card: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.card,
    ...continuous,
    backgroundColor: colors.raised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
  },
  pressed: { opacity: 0.6 },
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  badge: {
    width: BADGE,
    height: BADGE,
    borderRadius: radii.sm,
    ...continuous,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
  },
  code: { fontWeight: '700', letterSpacing: 0.5 },
  number: { flex: 1 },
  status: { alignItems: 'flex-end' },
  route: { flexDirection: 'row', alignItems: 'flex-start' },
  end: { flex: 1 },
  alignEnd: { alignItems: 'flex-end' },
  plane: { marginTop: spacing.sm },
  time: { fontWeight: '600' },
});
