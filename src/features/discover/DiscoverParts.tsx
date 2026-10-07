import type { ReactNode } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { EventsError } from '@/services/events';
import { screenPadding, spacing } from '@/theme';
import { Button, Text } from '@/ui';

import { eventCard, type DiscoverCard, type DiscoverFilter } from './discover';
import { CARD_WIDTH, DiscoverCardSkeleton, DiscoverCardView } from './DiscoverCardView';
import type { useDiscover } from './useDiscover';

/** The saved-videos row's heading (TR-34). */
export const REELS_TITLE = 'Saved from TikTok & Reels';

export const EMPTY_LABEL: Record<DiscoverFilter, string> = {
  all: 'No events found on your dates.',
  events: 'No shows or concerts on your dates.',
  food: 'No food events on your dates.',
  nightlife: 'No nightlife events on your dates.',
  sports: 'No sports on your dates.',
  networking: 'No networking events on your dates yet.',
};

/**
 * One trip's events row with its loading, error, empty and "no city yet" states (TR-31). Card
 * test IDs are `<testID>-card-<event id>`; the states are `<testID>-loading`, `-empty`, `-error`
 * and `-not-configured`.
 */
export function EventsRow({
  discover,
  filter,
  query,
  testID,
}: {
  discover: ReturnType<typeof useDiscover>;
  filter: DiscoverFilter;
  query: string;
  testID: string;
}) {
  const { data, trip, events, eventList, save, noPlace, tripError, retryTrip } = discover;

  if (tripError) {
    return (
      <View style={styles.retry}>
        <Note testID={`${testID}-error`}>{"Couldn't load this trip right now."}</Note>
        <Button label="Try again" variant="secondary" onPress={() => void retryTrip()} />
      </View>
    );
  }
  if (noPlace) return <Note>{"Add the trip's city and dates to see events."}</Note>;
  if (!data || !trip || events.isPending) return <SkeletonRow testID={`${testID}-loading`} />;
  if (events.isError) {
    return events.error instanceof EventsError && events.error.code === 'not_configured' ? (
      <Note testID={`${testID}-not-configured`}>
        {"Event listings aren't set up yet. Popular places still work."}
      </Note>
    ) : (
      <View style={styles.retry}>
        <Note testID={`${testID}-error`}>{"Couldn't load events right now."}</Note>
        <Button label="Try again" variant="secondary" onPress={() => void events.refetch()} />
      </View>
    );
  }
  if (eventList.length === 0) {
    return (
      <Note testID={`${testID}-empty`}>
        {query.trim() ? `No events match "${query.trim()}".` : EMPTY_LABEL[filter]}
      </Note>
    );
  }
  return (
    <CardRow
      cards={eventList.map((e) => eventCard(e, data))}
      onAdd={(card) => {
        const event = eventList.find((e) => e.id === card.id);
        if (event) void save.saveEvent(event);
      }}
      saving={save.saving}
      testID={testID}
    />
  );
}

export function Section({
  title,
  children,
  testID,
}: {
  title: string;
  children: ReactNode;
  testID?: string;
}) {
  return (
    <View style={styles.section} testID={testID}>
      <Text variant="headline" accessibilityRole="header">
        {title}
      </Text>
      {children}
    </View>
  );
}

export function Note({ children, testID }: { children: ReactNode; testID?: string }) {
  return (
    <Text variant="body" tone="secondary" testID={testID}>
      {children}
    </Text>
  );
}

export function CardRow({
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

function SkeletonRow({ testID }: { testID: string }) {
  return (
    <View style={[styles.row, styles.skeletonRow, styles.bleed]} testID={testID}>
      {[0, 1, 2].map((i) => (
        <DiscoverCardSkeleton key={i} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  /** Rows scroll edge to edge while their first card lines up with the screen margin. */
  bleed: { marginHorizontal: -screenPadding },
  section: { gap: spacing.md },
  row: { gap: spacing.md, paddingHorizontal: screenPadding },
  skeletonRow: { flexDirection: 'row', overflow: 'hidden' },
  retry: { gap: spacing.md, alignItems: 'flex-start' },
});
