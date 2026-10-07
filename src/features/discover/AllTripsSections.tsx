import { StyleSheet, View } from 'react-native';

import { now } from '@/core/clock';
import type { Trip } from '@/services/data';
import { spacing } from '@/theme';
import { Skeleton } from '@/ui';

import { tripSectionTitle, type DiscoverFilter } from './discover';
import { EventsRow, Note, Section } from './DiscoverParts';
import { useDiscover, useUpcomingTrips } from './useDiscover';

interface Props {
  filter: DiscoverFilter;
  query: string;
  notify: (message: string) => void;
}

/**
 * Discover's "All upcoming trips" (TR-33): one section per trip that hasn't ended, soonest first,
 * each with the events on its own dates. A card's `+` saves to that section's trip.
 */
export function AllTripsSections({ filter, query, notify }: Props) {
  const { trips, isPending } = useUpcomingTrips();

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
        <TripSection key={trip.id} trip={trip} filter={filter} query={query} notify={notify} />
      ))}
    </View>
  );
}

function TripSection({ trip, filter, query, notify }: Props & { trip: Trip }) {
  const discover = useDiscover(trip.id, filter, query, notify);
  return (
    <Section title={tripSectionTitle(trip, now())} testID={`discover-trip-${trip.id}`}>
      <EventsRow
        discover={discover}
        filter={filter}
        query={query}
        testID={`discover-trip-${trip.id}-events`}
      />
    </Section>
  );
}

const styles = StyleSheet.create({
  sections: { gap: spacing.xl },
  loading: { gap: spacing.md },
});
