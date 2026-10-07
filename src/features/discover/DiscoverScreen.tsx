import { useMemo, useState, type ReactNode } from 'react';
import { FlatList, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { tabTitle } from '@/core/tabs';
import { TripTitle } from '@/features/trips/TripTitle';
import { useTripData } from '@/services/data';
import { EventsError, eventsRequest, useTripEvents } from '@/services/events';
import { useTripStore } from '@/stores/trip';
import { colors, continuous, radii, screenPadding, spacing, typography } from '@/theme';
import { Button, Chip, Icon, IconButton, Skeleton, Text, Toast } from '@/ui';

import {
  eventCard,
  filterEvents,
  filterPopular,
  FILTERS,
  placeCard,
  type DiscoverCard,
  type DiscoverFilter,
} from './discover';
import { CARD_WIDTH, DiscoverCardSkeleton, DiscoverCardView } from './DiscoverCardView';
import { popularPlaces } from './popular';
import { useDiscoverSave } from './useDiscoverSave';

const EMPTY_LABEL: Record<DiscoverFilter, string> = {
  all: 'No events found on your dates.',
  events: 'No shows or concerts on your dates.',
  food: 'No food events on your dates.',
  nightlife: 'No nightlife events on your dates.',
  sports: 'No sports on your dates.',
  networking: 'No networking events on your dates yet.',
};

/**
 * The Discover tab (TR-31): what's on during the selected trip. A large title over the trip line
 * (tap to switch trips), a search field that filters what's loaded, the category chips, then
 * "Happening in <city>" (events on the trip's dates) and "Popular with travellers" (curated places).
 * Every card's `+` saves it to the trip's Bucket List.
 */
export function DiscoverScreen() {
  const insets = useSafeAreaInsets();
  const tripId = useTripStore((s) => s.selectedTripId);
  const tripData = useTripData(tripId);
  const data = tripData.data;
  const trip = data?.trip;
  const events = useTripEvents(trip);
  const save = useDiscoverSave(tripId, data?.places);
  const [filter, setFilter] = useState<DiscoverFilter>('all');
  const [query, setQuery] = useState('');

  const eventCards = useMemo(
    () => (data ? filterEvents(events.data ?? [], filter, query) : []),
    [data, events.data, filter, query],
  );
  const popular = useMemo(
    () =>
      trip && filter !== 'events' && filter !== 'sports' && filter !== 'networking'
        ? filterPopular(popularPlaces(trip.city), filter, query)
        : [],
    [trip, filter, query],
  );

  let happening: ReactNode;
  if (!data || !trip || events.isPending) {
    happening = <SkeletonRow />;
  } else if (events.isError) {
    happening =
      events.error instanceof EventsError && events.error.code === 'not_configured' ? (
        <Note testID="discover-not-configured">
          {"Event listings aren't set up yet. Popular places still work."}
        </Note>
      ) : (
        <View style={styles.retry}>
          <Note testID="discover-events-error">{"Couldn't load events right now."}</Note>
          <Button label="Try again" variant="secondary" onPress={() => void events.refetch()} />
        </View>
      );
  } else if (eventCards.length === 0) {
    happening = (
      <Note testID="discover-events-empty">
        {query.trim() ? `No events match "${query.trim()}".` : EMPTY_LABEL[filter]}
      </Note>
    );
  } else {
    happening = (
      <CardRow
        cards={eventCards.map((e) => eventCard(e, data))}
        onAdd={(card) => {
          const event = eventCards.find((e) => e.id === card.id);
          if (event) void save.saveEvent(event);
        }}
        saving={save.saving}
        testID="discover-events"
      />
    );
  }

  const noPlace = trip && !eventsRequest(trip);

  return (
    <View style={[styles.screen, { paddingTop: insets.top + spacing.sm }]}>
      <ScrollView
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
        testID="discover-screen"
      >
        <View style={styles.header}>
          <Text variant="largeTitle" accessibilityRole="header">
            {tabTitle('discover')}
          </Text>
          {trip ? (
            <TripTitle trip={trip} variant="inline" testID="discover-trip-title" />
          ) : tripId ? (
            <Skeleton width={200} height={18} testID="discover-trip-title-loading" />
          ) : null}
        </View>

        {!tripId ? (
          <Note testID="discover-no-trip">{"Add a trip to see what's on during your dates."}</Note>
        ) : (
          <>
            <SearchField value={query} onChange={setQuery} />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chips}
              style={styles.bleed}
              testID="discover-filters"
            >
              {FILTERS.map((f) => (
                <Chip
                  key={f.value}
                  label={f.label}
                  selected={filter === f.value}
                  onPress={() => setFilter(f.value)}
                  testID={`discover-filter-${f.value}`}
                />
              ))}
            </ScrollView>

            {filter === 'networking' ? (
              <Note testID="discover-networking-empty">{EMPTY_LABEL.networking}</Note>
            ) : (
              <Section title={trip ? `Happening in ${trip.city}` : 'Happening'}>
                {noPlace ? (
                  <Note>{"Add the trip's city and dates to see events."}</Note>
                ) : (
                  happening
                )}
              </Section>
            )}

            {popular.length > 0 && data ? (
              <Section title="Popular with travellers">
                <CardRow
                  cards={popular.map((p) => placeCard(p, data))}
                  onAdd={(card) => {
                    const place = popular.find((p) => p.id === card.id);
                    if (place) void save.savePopular(place);
                  }}
                  saving={save.saving}
                  testID="discover-popular"
                />
              </Section>
            ) : null}
          </>
        )}
      </ScrollView>
      {save.toast !== null ? (
        <View style={styles.toast}>
          <Toast
            visible
            message={save.toast}
            onDismiss={save.dismissToast}
            testID="discover-toast"
          />
        </View>
      ) : null}
    </View>
  );
}

function SearchField({ value, onChange }: { value: string; onChange: (text: string) => void }) {
  return (
    <View style={styles.field}>
      <Icon name="magnifyingglass" size="sm" tone="secondary" />
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder="Search events, places, restaurants"
        placeholderTextColor={colors.textSecondary}
        selectionColor={colors.accent}
        keyboardAppearance="dark"
        autoCorrect={false}
        returnKeyType="search"
        accessibilityLabel="Search events and places"
        style={styles.input}
        testID="discover-search"
      />
      {value ? (
        <IconButton
          icon="xmark.circle.fill"
          label="Clear search"
          variant="plain"
          size="sm"
          onPress={() => onChange('')}
          testID="discover-search-clear"
        />
      ) : null}
    </View>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text variant="headline" accessibilityRole="header">
        {title}
      </Text>
      {children}
    </View>
  );
}

function Note({ children, testID }: { children: ReactNode; testID?: string }) {
  return (
    <Text variant="body" tone="secondary" testID={testID}>
      {children}
    </Text>
  );
}

function CardRow({
  cards,
  onAdd,
  saving,
  testID,
}: {
  cards: DiscoverCard[];
  onAdd: (card: DiscoverCard) => void;
  saving: ReadonlySet<string>;
  testID: string;
}) {
  return (
    <FlatList
      horizontal
      data={cards}
      keyExtractor={(c) => c.id}
      renderItem={({ item }) => (
        <DiscoverCardView
          card={item}
          onAdd={() => onAdd(item)}
          saving={saving.has(item.id)}
          testID={`${testID}-card-${item.id}`}
        />
      )}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      style={styles.bleed}
      snapToInterval={CARD_WIDTH + spacing.md}
      decelerationRate="fast"
      testID={testID}
    />
  );
}

function SkeletonRow() {
  return (
    <View style={[styles.row, styles.skeletonRow, styles.bleed]} testID="discover-events-loading">
      {[0, 1, 2].map((i) => (
        <DiscoverCardSkeleton key={i} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { gap: spacing.lg, paddingHorizontal: screenPadding, paddingBottom: spacing.xxxl },
  header: { gap: spacing.xxs },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    height: 40,
    paddingHorizontal: spacing.md,
    borderRadius: radii.card,
    ...continuous,
    backgroundColor: colors.raised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
  },
  input: {
    ...typography.body,
    // No fixed line height in a TextInput: iOS clips the caret.
    lineHeight: undefined,
    flex: 1,
    height: '100%',
    color: colors.textPrimary,
  },
  /** Rows scroll edge to edge while their first card lines up with the screen margin. */
  bleed: { marginHorizontal: -screenPadding },
  chips: { gap: spacing.sm, paddingHorizontal: screenPadding },
  section: { gap: spacing.md },
  row: { gap: spacing.md, paddingHorizontal: screenPadding },
  skeletonRow: { flexDirection: 'row', overflow: 'hidden' },
  retry: { gap: spacing.md, alignItems: 'flex-start' },
  toast: { paddingHorizontal: screenPadding, paddingBottom: spacing.md },
});
