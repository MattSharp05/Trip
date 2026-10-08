import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { useFlightStatus } from '@/services/flightStatus';
import { colors, continuous, radii, screenPadding, spacing } from '@/theme';
import { Button, ListRow, LoadError, Skeleton, Surface, Text, Toast, useTabBarInset } from '@/ui';

import { addFlightToCalendar, openOriginal } from './actions';
import { FlightRoute } from './FlightRoute';
import { StatusPill } from './FlightStatusPill';
import { liveFacts } from './status';
import { useFlightBooking } from './useFlightBooking';
import { useWallet } from '../useWallet';

/**
 * A flight's details: airline, route with each airport's local times, the facts you need at the
 * airport, the boarding pass, and the original booking.
 */
export function FlightDetail({ id }: { id: string }) {
  const { loadError, retry } = useWallet();
  const tabBarInset = useTabBarInset();
  const router = useRouter();
  const { flight: booking, isLoading } = useFlightBooking(id);
  const [toast, setToast] = useState<string | null>(null);
  const flight = booking?.data;
  const status = useFlightStatus(flight);
  const facts = flight ? liveFacts(flight, status) : [];
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
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: tabBarInset + spacing.lg }]}
      >
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
              <View style={styles.airlineName}>
                <Text variant="body" style={styles.bold}>
                  {flight.airline}
                </Text>
                <Text variant="subhead" tone="secondary">
                  {flight.flightNumber}
                </Text>
              </View>
              <StatusPill flight={flight} status={status} />
            </View>

            <FlightRoute flight={flight} />

            {facts.length > 0 ? (
              <Surface padding="none" style={styles.facts} testID="flight-facts">
                {facts.map((fact, i) => (
                  <View key={fact.label} style={[styles.fact, i > 0 && styles.factDivider]}>
                    <Text variant="caption" tone="secondary">
                      {fact.label}
                    </Text>
                    <Text variant="headline" numberOfLines={1}>
                      {fact.value}
                    </Text>
                    {fact.updated ? (
                      <Text
                        variant="caption"
                        tone="accent"
                        testID={`flight-fact-updated-${fact.label.toLowerCase()}`}
                      >
                        Updated
                      </Text>
                    ) : null}
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
        ) : loadError ? (
          <LoadError message="Couldn't load this flight. Check your connection." onRetry={retry} />
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
  airlineName: { flex: 1 },
  bold: { fontWeight: '600' },
  facts: { flexDirection: 'row' },
  fact: { flex: 1, gap: spacing.xxs, padding: spacing.md },
  factDivider: { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: colors.hairline },
  missing: { alignItems: 'center', paddingTop: spacing.xxxl },
});
