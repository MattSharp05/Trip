import { useMutation, useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { ParseResult } from '../../../supabase/functions/_shared/parse/schema';
import { bookingSpan, matchTrip, proposedTrip } from '@/core/bookingMapping';
import { now } from '@/core/clock';
import { dateRangeLabel } from '@/core/dates';
import { useChooseTrip } from '@/features/trips/selectedTrip';
import {
  dataKeys,
  queryClient,
  useDataSource,
  useTrips,
  type NewTrip,
  type Trip,
} from '@/services/data';
import { findCoverPhoto, trackPhotoDownload } from '@/services/photos';
import { useImportStore } from '@/stores/import';
import { useTripStore } from '@/stores/trip';
import { colors, screenPadding, spacing } from '@/theme';
import { Button, Chip, IconButton, ListRow, Skeleton, Surface, Text } from '@/ui';

import { draftFrom, fieldsFor, finishDraft, switchType, TYPE_OPTIONS, type Draft } from './draft';
import { importErrorMessage, readBooking, type ReadBooking } from './readBooking';
import { ReviewFields } from './ReviewFields';
import { saveImport } from './saveImport';

/**
 * Booking import (TR-25): reads the picked file ("Reading your booking"), then the review screen:
 * every field editable, the type switchable, doubtful fields flagged, and the trip it goes in (or
 * the trip it would create). Saving adds the card, pins, plan items and expense.
 */
export function ImportScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const source = useDataSource();
  const file = useImportStore((s) => s.file);

  const read = useQuery(
    {
      queryKey: ['import', source.id, file?.uri ?? ''],
      queryFn: () => readBooking(source, file!),
      enabled: file !== null,
      retry: false,
      staleTime: Infinity,
      gcTime: 0,
    },
    queryClient,
  );

  return (
    <View style={[styles.screen, { paddingTop: insets.top + spacing.sm }]} testID="import-screen">
      <View style={styles.bar}>
        <IconButton
          icon="chevron.left"
          label="Back"
          variant="plain"
          onPress={() => router.back()}
          testID="import-back"
        />
        <Text variant="headline" accessibilityRole="header">
          {read.data ? 'Review booking' : 'Import booking'}
        </Text>
        <View style={styles.barSpacer} />
      </View>
      {!file ? (
        <Message title="No file picked" body="Tap + on Organize to choose a PDF or screenshot." />
      ) : read.isError ? (
        <Message
          title="Couldn't read this booking"
          body={importErrorMessage(read.error)}
          onRetry={() => void read.refetch()}
          testID="import-error"
        />
      ) : read.data ? (
        <Review read={read.data} key={read.dataUpdatedAt} />
      ) : (
        <Reading name={file.name} />
      )}
    </View>
  );
}

function Reading({ name }: { name: string }) {
  return (
    <View style={styles.body} testID="import-reading">
      <View style={styles.readingTitle}>
        <Text variant="title">Reading your booking</Text>
        <Text variant="subhead" tone="secondary" numberOfLines={1}>
          {name}
        </Text>
      </View>
      <Skeleton height={40} radius="card" />
      {[0, 1, 2, 3, 4].map((i) => (
        <Skeleton key={i} height={50} radius="card" />
      ))}
    </View>
  );
}

function Message({
  title,
  body,
  onRetry,
  testID,
}: {
  title: string;
  body: string;
  onRetry?: () => void;
  testID?: string;
}) {
  return (
    <View style={[styles.body, styles.message]} testID={testID}>
      <Text variant="headline">{title}</Text>
      <Text variant="body" tone="secondary" style={styles.center}>
        {body}
      </Text>
      {onRetry ? (
        <Button label="Try again" variant="secondary" onPress={onRetry} testID="import-retry" />
      ) : null}
    </View>
  );
}

type Target = { trip: Trip } | { create: NewTrip } | null;

/** Where the booking goes: its matching trip, a new trip for it, or the trip on screen. */
function useTarget(result: ParseResult, draft: Draft): Target {
  const trips = useTrips().data;
  const selectedId = useTripStore((s) => s.selectedTripId);
  return useMemo(() => {
    if (!trips) return null;
    const finished = finishDraft(draft);
    const booking = 'booking' in finished ? finished.booking : result.booking;
    const span = bookingSpan(booking);
    const match = matchTrip(span, trips);
    if (match) return { trip: match };
    const create = proposedTrip(span);
    if (create) return { create };
    const selected = trips.find((t) => t.id === selectedId);
    return selected ? { trip: selected } : null;
  }, [trips, draft, result, selectedId]);
}

function Review({ read }: { read: ReadBooking }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const source = useDataSource();
  const chooseTrip = useChooseTrip();
  const saved = useImportStore((s) => s.saved);
  const [draft, setDraft] = useState(() => draftFrom(read.result.booking, read.result.uncertain));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const target = useTarget(read.result, draft);
  const fields = fieldsFor(draft.base);

  const save = useMutation(
    {
      mutationFn: async ({
        booking,
        target: to,
      }: {
        booking: Draft['base'];
        target: NonNullable<Target>;
      }) => {
        let resolved = to;
        let photoLocation: string | null = null;
        if ('create' in to && source.kind === 'supabase') {
          // A new trip gets a cover photo when Unsplash has one; a failed lookup never blocks.
          const photo = await findCoverPhoto(
            [to.create.city, to.create.country].filter(Boolean).join(' '),
          ).catch(() => null);
          if (photo) {
            photoLocation = photo.downloadLocation;
            resolved = {
              create: {
                ...to.create,
                coverPhotoUrl: photo.url,
                coverPhotoCredit: {
                  source: 'unsplash',
                  photographer: photo.photographer,
                  photographerUrl: photo.photographerUrl,
                  photoUrl: photo.photoUrl,
                },
              },
            };
          }
        }
        const result = await saveImport(source, {
          booking,
          target: resolved,
          originalPath: read.originalPath,
          importedAt: now().toISOString(),
        });
        if (photoLocation) void trackPhotoDownload(photoLocation).catch(() => {});
        return result;
      },
      onSettled: () => queryClient.invalidateQueries({ queryKey: dataKeys.all(source) }),
    },
    queryClient,
  );

  const change = (path: string, value: string) => {
    setDraft((d) => ({ ...d, values: { ...d.values, [path]: value } }));
    setErrors((e) => {
      if (!e[path]) return e;
      const { [path]: _gone, ...rest } = e;
      return rest;
    });
    setSaveError(null);
  };

  const submit = async () => {
    const finished = finishDraft(draft);
    if ('errors' in finished) {
      setErrors(finished.errors);
      setSaveError('Fix the highlighted fields to save.');
      return;
    }
    if (!target) {
      setSaveError('Add the city it is in, so we can find its trip.');
      return;
    }
    try {
      const result = await save.mutateAsync({ booking: finished.booking, target });
      chooseTrip(result.trip.id);
      saved(result.message);
      router.back();
    } catch {
      setSaveError("Couldn't save the booking. Check your connection and try again.");
    }
  };

  return (
    <>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
        testID="import-review"
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
          testID="import-types"
        >
          {TYPE_OPTIONS.map((option) => (
            <Chip
              key={option.value}
              label={option.label}
              selected={option.value === draft.base.type}
              onPress={() => {
                setDraft((d) => switchType(d, option.value));
                setErrors({});
              }}
              testID={`import-type-${option.value}`}
            />
          ))}
        </ScrollView>
        <TripTarget target={target} />
        <ReviewFields
          fields={fields}
          values={draft.values}
          uncertain={draft.uncertain}
          errors={errors}
          onChange={change}
        />
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        {saveError ? (
          <Text
            variant="subhead"
            tone="secondary"
            accessibilityLiveRegion="polite"
            testID="import-save-error"
          >
            {saveError}
          </Text>
        ) : null}
        <Button
          label={target && 'create' in target ? 'Create trip and save' : 'Save to wallet'}
          onPress={() => void submit()}
          disabled={save.isPending}
          testID="import-save"
        />
      </View>
    </>
  );
}

function TripTarget({ target }: { target: Target }) {
  if (!target) {
    return <Skeleton height={62} radius="card" testID="import-trip-loading" />;
  }
  if ('create' in target) {
    const { city, startDate, endDate } = target.create;
    return (
      <Surface padding="none" testID="import-new-trip">
        <ListRow
          icon="suitcase"
          title={`Create ${city} trip, ${dateRangeLabel(startDate, endDate)}?`}
          subtitle="No trip matches these dates yet."
        />
      </Surface>
    );
  }
  const { trip } = target;
  return (
    <Surface padding="none" testID="import-trip">
      <ListRow
        icon="suitcase"
        title={`Adds to ${trip.city}`}
        subtitle={dateRangeLabel(trip.startDate, trip.endDate)}
      />
    </Surface>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.sm,
  },
  barSpacer: { width: 36 },
  scroll: { flex: 1 },
  body: { gap: spacing.md, paddingHorizontal: screenPadding, paddingBottom: spacing.xl },
  readingTitle: { gap: spacing.xxs, paddingTop: spacing.md },
  message: { alignItems: 'center', paddingTop: spacing.xxxl },
  center: { textAlign: 'center' },
  chips: { gap: spacing.sm },
  footer: {
    gap: spacing.sm,
    paddingHorizontal: screenPadding,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairline,
    backgroundColor: colors.background,
  },
});
