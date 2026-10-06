import DateTimePicker from '@react-native-community/datetimepicker';
import { format, parseISO } from 'date-fns';
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { now } from '@/core/clock';
import { addDaysTo } from '@/core/trips';
import { useCreateTrip } from '@/services/data';
import type { PlaceResult } from '@/services/places';
import { findCoverPhoto, trackPhotoDownload } from '@/services/photos';
import { colors, continuous, radii, screenPadding, spacing } from '@/theme';
import { Button, Text } from '@/ui';

import { DestinationSearch, PickedDestination } from './DestinationSearch';
import { buildNewTrip } from './newTrip';
import { useChooseTrip } from './selectedTrip';

const toDate = (day: string) => parseISO(day);
const toDay = (date: Date) => format(date, 'yyyy-MM-dd');

function DateRow({
  label,
  value,
  minimum,
  onChange,
  testID,
  separator = false,
}: {
  label: string;
  value: string;
  minimum?: string;
  onChange: (day: string) => void;
  testID: string;
  separator?: boolean;
}) {
  return (
    <View style={[styles.dateRow, separator && styles.separator]}>
      <Text variant="body">{label}</Text>
      <DateTimePicker
        value={toDate(value)}
        mode="date"
        display="compact"
        themeVariant="dark"
        accentColor={colors.accent}
        minimumDate={minimum ? toDate(minimum) : undefined}
        onChange={(_event, date) => {
          if (date) onChange(toDay(date));
        }}
        accessibilityLabel={label}
        testID={testID}
      />
    </View>
  );
}

/**
 * Create a trip (TR-10): search a destination, choose the dates, save. The trip gets the
 * destination's timezone and, when Unsplash has one, a cover photo with its credit.
 */
export function CreateTripScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const createTrip = useCreateTrip();
  const chooseTrip = useChooseTrip();
  const [place, setPlace] = useState<PlaceResult | null>(null);
  const [startDate, setStartDate] = useState(() => toDay(now()));
  const [endDate, setEndDate] = useState(() => addDaysTo(toDay(now()), 4));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Moving the start keeps the end on or after it.
  const changeStart = (day: string) => {
    setStartDate(day);
    if (endDate < day) setEndDate(day);
  };

  const save = async () => {
    if (!place || saving) return;
    setSaving(true);
    setError(null);
    try {
      const { trip, photo } = await buildNewTrip(place, startDate, endDate, findCoverPhoto);
      const created = await createTrip.mutateAsync(trip);
      if (photo) void trackPhotoDownload(photo.downloadLocation).catch(() => {});
      chooseTrip(created.id);
      router.back();
    } catch {
      setError("Couldn't save the trip. Check your connection and try again.");
      setSaving(false);
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerLeft: () => (
            <Pressable accessibilityRole="button" onPress={() => router.back()} hitSlop={8}>
              <Text variant="body">Cancel</Text>
            </Pressable>
          ),
        }}
      />
      <ScrollView
        style={styles.screen}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}
        keyboardShouldPersistTaps="handled"
        testID="create-trip"
      >
        <View style={styles.section}>
          <Text variant="headline">Where to?</Text>
          {place ? (
            <PickedDestination place={place} onChange={() => setPlace(null)} />
          ) : (
            <DestinationSearch onPick={setPlace} />
          )}
        </View>

        {place ? (
          <>
            <View style={styles.section}>
              <Text variant="headline">When?</Text>
              <View style={styles.card}>
                <DateRow
                  label="Start"
                  value={startDate}
                  onChange={changeStart}
                  testID="create-trip-start"
                  separator
                />
                <DateRow
                  label="End"
                  value={endDate}
                  minimum={startDate}
                  onChange={setEndDate}
                  testID="create-trip-end"
                />
              </View>
            </View>
            {error ? (
              <Text variant="subhead" accessibilityRole="alert" testID="create-trip-error">
                {error}
              </Text>
            ) : null}
            <Button
              label={saving ? 'Saving…' : 'Save trip'}
              onPress={() => void save()}
              disabled={saving}
              testID="create-trip-save"
            />
          </>
        ) : null}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { gap: spacing.xxl, padding: screenPadding },
  section: { gap: spacing.md },
  card: {
    borderRadius: radii.card,
    ...continuous,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 52,
    paddingHorizontal: spacing.md,
  },
  separator: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.hairline },
});
