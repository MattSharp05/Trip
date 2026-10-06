import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { colors, continuous, radii, screenPadding, spacing } from '@/theme';
import { Button, ListRow, Skeleton, Surface, Text, Toast } from '@/ui';

import { addFlightToCalendar, openOriginal } from './actions';
import { flightFacts } from './flightInfo';
import { FlightRoute } from './FlightRoute';
import { useFlightBooking } from './useFlightBooking';

/**
 * A flight's details: airline, route with each airport's local times, the facts you need at the
 * airport, the boarding pass, and the original booking.
 */
export function FlightDetail({ id }: { id: string }) {
  const router = useRouter();
  const { flight: booking, isLoading } = useFlightBooking(id);
  const [toast, setToast] = useState<string | null>(null);
  const flight = booking?.data;
  const originalPath = booking?.originalPath ?? null;

  const addToCalendar = async () => {
    if (!flight) return;
    try {
      if (await addFlightToCalendar(flight)) setToast('Added to your calendar');
    } catch {
      setToast("Couldn't open your calendar");
    }
  };

  const viewOriginal = async () => {
    if (!originalPath) return;
    try {
      await openOriginal(originalPath);
    } catch {
      setToast("Couldn't open the original booking");
    }
  };

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Stack.Screen
          options={{ headerShown: true, title: 'Flight details', headerBackTitle: 'Organize' }}
        />
        {isLoading ? (
          <>
            <Skeleton height={56} radius="card" />
            <Skeleton height={160} radius="card" />
          </>
        ) : flight ? (
          <>
            <View style={styles.airline}>
              <View style={styles.badge}>
                <Text variant="subhead" style={styles.code}>
                  {flight.airlineCode}
                </Text>
              </View>
              <View>
                <Text variant="body" style={styles.bold}>
                  {flight.airline}
                </Text>
                <Text variant="subhead" tone="secondary">
                  {flight.flightNumber}
                </Text>
              </View>
            </View>

            <FlightRoute flight={flight} />

            {flightFacts(flight).length > 0 ? (
              <Surface padding="none" style={styles.facts} testID="flight-facts">
                {flightFacts(flight).map((fact, i) => (
                  <View key={fact.label} style={[styles.fact, i > 0 && styles.factDivider]}>
                    <Text variant="caption" tone="secondary">
                      {fact.label}
                    </Text>
                    <Text variant="headline" numberOfLines={1}>
                      {fact.value}
                    </Text>
                  </View>
                ))}
              </Surface>
            ) : null}

            <Button
              label="View boarding pass"
              icon="qrcode"
              onPress={() => router.push(`/organize/pass/${encodeURIComponent(id)}`)}
              testID="flight-view-pass"
            />

            <Surface padding="none">
              {originalPath ? (
                <ListRow
                  icon="doc.text"
                  title="View original booking"
                  onPress={viewOriginal}
                  separator
                  testID="flight-original"
                />
              ) : null}
              <ListRow
                icon="calendar.badge.plus"
                title="Add to calendar"
                onPress={addToCalendar}
                testID="flight-calendar"
              />
            </Surface>
          </>
        ) : (
          <View style={styles.missing}>
            <Text variant="headline">This flight is no longer in your wallet</Text>
          </View>
        )}
      </ScrollView>
      <Toast visible={toast !== null} message={toast ?? ''} onDismiss={() => setToast(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { gap: spacing.xl, padding: screenPadding },
  airline: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  badge: {
    width: 44,
    height: 44,
    borderRadius: radii.sm,
    ...continuous,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.raised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
  },
  code: { fontWeight: '700', letterSpacing: 0.5 },
  bold: { fontWeight: '600' },
  facts: { flexDirection: 'row' },
  fact: { flex: 1, gap: spacing.xxs, padding: spacing.md },
  factDivider: { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: colors.hairline },
  missing: { alignItems: 'center', paddingTop: spacing.xxxl },
});
