import { StyleSheet, View } from 'react-native';

import { now } from '@/core/clock';
import type { Trip } from '@/services/data';
import { spacing } from '@/theme';
import type { CityReel } from '@/services/cityLinks';
import { LoadError, Skeleton, Text } from '@/ui';

import { tripSectionTitle, type DiscoverFilter } from './discover';
import { EventsRow, Note, REELS_TITLE, Section } from './DiscoverParts';
import { ReelsRow } from './ReelsRow';
import { useDiscover, useUpcomingTrips } from './useDiscover';

interface Props {
  filter: DiscoverFilter;
  query: string;
  notify: (message: string) => void;
  /** Opens a saved video's places, to save to that trip. */
  openReel: (trip: Trip, reel: CityReel) => void;
}

/**
 * Discover's "All upcoming trips" (TR-33): one section per trip that hasn't ended, soonest first,
 * each with the events on its own dates and the saved videos for its city (TR-34). A card's `+`
 * and a video's places save to that section's trip.
 */
export function AllTripsSections({ filter, query, notify, openReel }: Props) {
  const { trips, isPending, isError, retry } = useUpcomingTrips();

  if (isError) {
    return (
      <LoadError
        message="Couldn't load your trips. Check your connection."
        onRetry={retry}
        testID="discover-all-error"
      />
    );
  }
  if (isPending) {
    return (
      <View style={styles.loading} testID="discover-all-loading">
        <Skeleton width={260} height={20} />
        <Skeleton height={120} radius="card" />
      </View>
    );
  }
  if (!trips?.length) {
    return (
      <Note testID="discover-all-empty">{"No upcoming trips. Add one to see what's on."}</Note>
    );
  }
  return (
    <View style={styles.sections} testID="discover-all">
      {trips.map((trip) => (
        <TripSection
          key={trip.id}
          trip={trip}
          filter={filter}
          query={query}
          notify={notify}
          openReel={openReel}
        />
      ))}
    </View>
  );
}

function TripSection({ trip, filter, query, notify, openReel }: Props & { trip: Trip }) {
  const discover = useDiscover(trip.id, filter, query, notify);
  return (
    <Section title={tripSectionTitle(trip, now())} testID={`discover-trip-${trip.id}`}>
      <EventsRow
        discover={discover}
        filter={filter}
        query={query}
        testID={`discover-trip-${trip.id}-events`}
      />
      {discover.reels.length > 0 ? (
        <View style={styles.reels}>
          <Text variant="subhead" tone="secondary">
            {REELS_TITLE}
          </Text>
          <ReelsRow
            reels={discover.reels}
            onOpen={(reel) => openReel(trip, reel)}
            testID={`discover-trip-${trip.id}-reels`}
          />
        </View>
      ) : null}
    </Section>
  );
}

const styles = StyleSheet.create({
  sections: { gap: spacing.xl },
  loading: { gap: spacing.md },
  reels: { gap: spacing.sm, marginTop: spacing.xs },
});
