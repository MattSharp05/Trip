import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { tabTitle } from '@/core/tabs';
import { LinkResultsSheet, useLinkFlow } from '@/features/links';
import { TripTitle } from '@/features/trips/TripTitle';
import type { CityReel } from '@/services/cityLinks';
import { useTripData, type Trip } from '@/services/data';
import { useTripStore } from '@/stores/trip';
import { colors, continuous, radii, screenPadding, spacing, typography } from '@/theme';
import { Chip, Icon, IconButton, Skeleton, Text, Toast, useTabBarInset } from '@/ui';

import { AllTripsSections } from './AllTripsSections';
import { FILTERS, placeCard, type DiscoverFilter } from './discover';
import { CardRow, EventsRow, Note, REELS_TITLE, Section } from './DiscoverParts';
import { ReelsRow } from './ReelsRow';
import { useDiscover } from './useDiscover';

/**
 * The Discover tab (TR-31): what's on during the selected trip. A large title over the trip line
 * (tap to switch trips, or pick "All upcoming trips"), a search field that filters what's loaded,
 * the category chips, then "Happening in <city>" (events on the trip's dates) and "Popular with
 * travellers" (curated places) and "Saved from TikTok & Reels" (TR-34: videos saved for the city;
 * tapping one opens its places in the TR-30 results sheet). With all upcoming trips (TR-33)
 * there's one section per trip instead. Every card's `+` saves it to its trip's Bucket List.
 */
export function DiscoverScreen() {
  const insets = useSafeAreaInsets();
  const tabBarInset = useTabBarInset();
  const tripId = useTripStore((s) => s.selectedTripId);
  const discoverAll = useTripStore((s) => s.discoverAll);
  const setDiscoverAll = useTripStore((s) => s.setDiscoverAll);
  const trip = useTripData(tripId).data?.trip;
  const [filter, setFilter] = useState<DiscoverFilter>('all');
  const [query, setQuery] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const notify = useCallback((message: string) => setToast(message), []);

  // A tapped video's places save to the trip whose section it's in.
  const [reelTrip, setReelTrip] = useState<Trip | null>(null);
  const linkArea = useMemo(
    () => ({
      city: reelTrip?.city ?? null,
      near:
        reelTrip && reelTrip.lat !== null && reelTrip.lng !== null
          ? { lat: reelTrip.lat, lng: reelTrip.lng }
          : null,
    }),
    [reelTrip],
  );
  const links = useLinkFlow(reelTrip?.id ?? null, linkArea);
  const { open: openLink, dismissToast: dismissLinkToast } = links;
  const openReel = useCallback(
    (forTrip: Trip, reel: CityReel) => {
      setReelTrip(forTrip);
      openLink(reel.url);
    },
    [openLink],
  );
  const message = links.toast?.message ?? toast;

  let body: ReactNode;
  if (discoverAll) {
    body = <AllTripsSections filter={filter} query={query} notify={notify} openReel={openReel} />;
  } else {
    body = (
      <SelectedTrip
        tripId={tripId}
        filter={filter}
        query={query}
        notify={notify}
        openReel={openReel}
      />
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top + spacing.sm }]}>
      <ScrollView
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, { paddingBottom: tabBarInset + spacing.lg }]}
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
            <Skeleton width={220} height={22} testID="discover-trip-title-loading" />
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
      <Toast
        visible={message !== null}
        message={message ?? ''}
        onDismiss={() => {
          setToast(null);
          dismissLinkToast();
        }}
        testID="discover-toast"
      />
      <LinkResultsSheet flow={links} near={linkArea.near} />
    </View>
  );
}

interface BodyProps {
  tripId: string | null;
  filter: DiscoverFilter;
  query: string;
  notify: (message: string) => void;
  openReel: (trip: Trip, reel: CityReel) => void;
}

/**
 * The selected trip: "Happening in <city>", "Popular with travellers" and "Saved from TikTok &
 * Reels".
 */
function SelectedTrip({ tripId, filter, query, notify, openReel }: BodyProps) {
  const discover = useDiscover(tripId, filter, query, notify);
  const { data, trip, popular, reels, save } = discover;
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
      {trip && reels.length > 0 ? (
        <Section title={REELS_TITLE}>
          <ReelsRow reels={reels} onOpen={(reel) => openReel(trip, reel)} testID="discover-reels" />
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
  content: { gap: spacing.lg, paddingHorizontal: screenPadding },
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
});
