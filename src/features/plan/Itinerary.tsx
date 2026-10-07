import { BottomSheetFlatList, type BottomSheetFlatListMethods } from '@gorhom/bottom-sheet';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import { useDistanceUnit } from '@/features/settings';
import { screenPadding, spacing } from '@/theme';
import { Button, Text } from '@/ui';

import type { ItineraryEntry } from './itinerary';
import { ItineraryRow, ItinerarySkeletonRow, ROW_HEIGHT } from './ItineraryRow';
import { LEG_HEIGHT, TravelLeg } from './TravelLeg';

const SKELETON_ROWS = 4;
/** Where a revealed row lands: a third of the way down the visible list. */
const REVEAL_POSITION = 0.3;

export interface ItineraryProps {
  /** The day's entries; undefined while the trip loads. */
  entries: ItineraryEntry[] | undefined;
  selectedId: string | null;
  /** Changes on every pick; when `reveal` is set the list scrolls the pick into view. */
  revealKey: number;
  /** The map made the pick: a tapped row is already where the finger is, so only then scroll. */
  reveal: boolean;
  onSelect: (id: string) => void;
  /** The free-day state's button: switches the sheet to the Bucket List. */
  onOpenBucketList: () => void;
  /** Room under the last row for the tab bar. */
  bottomInset: number;
}

/** A row plus, under it, the travel leg to the next stop when there is one. */
const itemHeight = (entry: ItineraryEntry) => ROW_HEIGHT + (entry.leg ? LEG_HEIGHT : 0);

/**
 * The day's timeline inside the Plan sheet, with the estimated travel between stops, a free-day
 * state and skeleton rows.
 */
export function Itinerary({
  entries,
  selectedId,
  revealKey,
  reveal,
  onSelect,
  onOpenBucketList,
  bottomInset,
}: ItineraryProps) {
  const list = useRef<BottomSheetFlatListMethods>(null);
  const unit = useDistanceUnit();
  const index = entries && selectedId ? entries.findIndex((e) => e.id === selectedId) : -1;

  const revealed = useRef(revealKey);
  useEffect(() => {
    if (revealed.current === revealKey) return;
    revealed.current = revealKey;
    if (reveal && index >= 0) {
      list.current?.scrollToIndex({ index, animated: true, viewPosition: REVEAL_POSITION });
    }
  }, [revealKey, reveal, index]);

  const renderItem = useCallback(
    ({ item, index: i }: { item: ItineraryEntry; index: number }) => (
      <>
        <ItineraryRow
          entry={item}
          selected={item.id === selectedId}
          first={i === 0}
          last={entries !== undefined && i === entries.length - 1}
          onPress={onSelect}
        />
        {item.leg ? (
          <TravelLeg leg={item.leg} unit={unit} testID={`travel-leg-${item.id}`} />
        ) : null}
      </>
    ),
    [selectedId, entries, onSelect, unit],
  );

  // Rows with a leg under them are taller: offsets add up the heights before each row.
  const offsets = useMemo(() => {
    const result = [0];
    for (const entry of entries ?? []) result.push(result[result.length - 1] + itemHeight(entry));
    return result;
  }, [entries]);

  if (!entries) {
    return (
      <View testID="itinerary-loading">
        {Array.from({ length: SKELETON_ROWS }, (_, i) => (
          <ItinerarySkeletonRow key={i} />
        ))}
      </View>
    );
  }

  if (entries.length === 0) {
    return (
      <View style={styles.empty} testID="itinerary-free-day">
        <Text variant="body" tone="secondary" style={styles.emptyText}>
          Free day. Use Smart Add on your Bucket List to fill it.
        </Text>
        <Button
          label="Open Bucket List"
          variant="secondary"
          icon="list.bullet"
          onPress={onOpenBucketList}
        />
      </View>
    );
  }

  return (
    <BottomSheetFlatList
      ref={list}
      data={entries}
      keyExtractor={(e: ItineraryEntry) => e.id}
      renderItem={renderItem}
      extraData={`${selectedId}:${unit}`}
      getItemLayout={(_: unknown, i: number) => ({
        length: offsets[i + 1] - offsets[i],
        offset: offsets[i],
        index: i,
      })}
      contentContainerStyle={{ paddingBottom: bottomInset }}
      testID="itinerary-list"
    />
  );
}

const styles = StyleSheet.create({
  empty: {
    alignItems: 'center',
    gap: spacing.lg,
    paddingHorizontal: screenPadding * 2,
    paddingTop: spacing.xxl,
  },
  emptyText: { textAlign: 'center' },
});
