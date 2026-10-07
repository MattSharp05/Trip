import { useCallback, useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { tabTitle } from '@/core/tabs';
import { TripTitle } from '@/features/trips/TripTitle';
import { useTripData } from '@/services/data';
import { useTripStore } from '@/stores/trip';
import { colors, continuous, radii, screenPadding, spacing, typography } from '@/theme';
import { Chip, Icon, IconButton, Skeleton, Text, Toast } from '@/ui';

import { AllTripsSections } from './AllTripsSections';
import { FILTERS, placeCard, type DiscoverFilter } from './discover';
import { CardRow, EMPTY_LABEL, EventsRow, Note, Section } from './DiscoverParts';
import { useDiscover } from './useDiscover';

/**
 * The Discover tab (TR-31): what's on during the selected trip. A large title over the trip line
 * (tap to switch trips, or pick "All upcoming trips"), a search field that filters what's loaded,
 * the category chips, then "Happening in <city>" (events on the trip's dates) and "Popular with
 * travellers" (curated places). With all upcoming trips (TR-33) there's one events section per
 * trip instead. Every card's `+` saves it to its trip's Bucket List.
 */
export function DiscoverScreen() {
  const insets = useSafeAreaInsets();
  const tripId = useTripStore((s) => s.selectedTripId);
  const discoverAll = useTripStore((s) => s.discoverAll);
  const setDiscoverAll = useTripStore((s) => s.setDiscoverAll);
  const trip = useTripData(tripId).data?.trip;
  const [filter, setFilter] = useState<DiscoverFilter>('all');
  const [query, setQuery] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const notify = useCallback((message: string) => setToast(message), []);

  let body: ReactNode;
  if (filter === 'networking') {
    body = <Note testID="discover-networking-empty">{EMPTY_LABEL.networking}</Note>;
  } else if (discoverAll) {
    body = <AllTripsSections filter={filter} query={query} notify={notify} />;
  } else {
    body = <SelectedTrip tripId={tripId} filter={filter} query={query} notify={notify} />;
  }

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
            <TripTitle
              trip={trip}
              variant="inline"
              allUpcoming={{ selected: discoverAll, onChange: setDiscoverAll }}
              testID="discover-trip-title"
            />
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
            {body}
          </>
        )}
      </ScrollView>
      {toast !== null ? (
        <View style={styles.toast}>
          <Toast visible message={toast} onDismiss={() => setToast(null)} testID="discover-toast" />
        </View>
      ) : null}
    </View>
  );
}

interface BodyProps {
  tripId: string | null;
  filter: DiscoverFilter;
  query: string;
  notify: (message: string) => void;
}

/** The selected trip: "Happening in <city>" and "Popular with travellers". */
function SelectedTrip({ tripId, filter, query, notify }: BodyProps) {
  const discover = useDiscover(tripId, filter, query, notify);
  const { data, trip, popular, save } = discover;
  return (
    <>
      <Section title={trip ? `Happening in ${trip.city}` : 'Happening'}>
        <EventsRow discover={discover} filter={filter} query={query} testID="discover-events" />
      </Section>
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
  toast: { paddingHorizontal: screenPadding, paddingBottom: spacing.md },
});
