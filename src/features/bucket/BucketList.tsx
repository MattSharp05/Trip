import { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';

import { screenPadding, spacing } from '@/theme';
import { Button, Skeleton, Text } from '@/ui';

import type { BucketEntry } from './bucket';
import { BUCKET_ROW_HEIGHT, BucketRow } from './BucketRow';
import { SmartAddButton } from './SmartAddButton';

const SKELETON_ROWS = 4;

export interface BucketListProps {
  /** The trip's saved places; undefined while the trip loads. */
  entries: BucketEntry[] | undefined;
  onSelect: (entry: BucketEntry) => void;
  onDelete: (entry: BucketEntry) => void;
  /** Smart Add: places the item in the best day and time. */
  onSmartAdd?: (entry: BucketEntry) => void;
  /** Opens the Add sheet (search, or drop a pin). */
  onAdd: () => void;
  /** Room under the last row for the tab bar. */
  bottomInset: number;
}

/** The Bucket List segment of the Plan sheet: saved places without a day, and a way to add one. */
export function BucketList({
  entries,
  onSelect,
  onDelete,
  onSmartAdd,
  onAdd,
  bottomInset,
}: BucketListProps) {
  const renderItem = useCallback(
    ({ item }: { item: BucketEntry }) => (
      <BucketRow
        entry={item}
        onPress={onSelect}
        onDelete={onDelete}
        action={onSmartAdd ? <SmartAddButton entry={item} onPress={onSmartAdd} /> : undefined}
      />
    ),
    [onSelect, onDelete, onSmartAdd],
  );

  const add = (
    <View style={styles.add}>
      <Button
        label="Add a place"
        variant="secondary"
        icon="plus"
        onPress={onAdd}
        testID="bucket-add"
      />
    </View>
  );

  if (!entries) {
    return (
      <View testID="bucket-loading" style={styles.skeletons}>
        {Array.from({ length: SKELETON_ROWS }, (_, i) => (
          <View key={i} style={styles.skeletonRow}>
            <View style={styles.skeletonText}>
              <Skeleton width="60%" height={14} />
              <Skeleton width="40%" height={12} />
            </View>
            <Skeleton width={44} height={44} radius="sm" />
          </View>
        ))}
      </View>
    );
  }

  if (entries.length === 0) {
    return (
      <View style={styles.empty} testID="bucket-empty">
        <Text variant="body" tone="secondary" style={styles.emptyText}>
          Save places you want to fit in: restaurants, bars, sights. Search for one, or touch and
          hold the map to drop a pin.
        </Text>
        {add}
      </View>
    );
  }

  return (
    <BottomSheetFlatList
      data={entries}
      keyExtractor={(e: BucketEntry) => e.id}
      renderItem={renderItem}
      getItemLayout={(_: unknown, i: number) => ({
        length: BUCKET_ROW_HEIGHT,
        offset: BUCKET_ROW_HEIGHT * i,
        index: i,
      })}
      ListFooterComponent={add}
      contentContainerStyle={{ paddingBottom: bottomInset }}
      testID="bucket-list"
    />
  );
}

const styles = StyleSheet.create({
  add: { paddingHorizontal: screenPadding, paddingTop: spacing.md, alignItems: 'center' },
  skeletons: { paddingHorizontal: screenPadding },
  skeletonRow: {
    height: BUCKET_ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  skeletonText: { flex: 1, gap: spacing.sm },
  empty: {
    alignItems: 'center',
    gap: spacing.lg,
    paddingHorizontal: screenPadding * 2,
    paddingTop: spacing.xxl,
  },
  emptyText: { textAlign: 'center' },
});
