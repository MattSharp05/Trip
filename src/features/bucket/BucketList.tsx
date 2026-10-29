import { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';

import type { BucketSort } from '@/core/bucket';
import { screenPadding, spacing } from '@/theme';
import { Button, Segmented, Skeleton, Text } from '@/ui';

import type { BucketEntry } from './bucket';
import { BUCKET_ROW_HEIGHT, BucketRow } from './BucketRow';
import { PLAN_ALL_HEIGHT, PlanAllButton } from './PlanAllButton';
import { SmartAddButton } from './SmartAddButton';

const SKELETON_ROWS = 4;

/** The sort row's height: the 34 pt control and the space above it. */
const SORT_HEIGHT = 34 + spacing.sm;
/** Suggest times: the 50 pt button and the space under it (Plan my bucket list pads above). */
const SUGGEST_HEIGHT = 50 + spacing.md;

const SORTS = [
  { value: 'popular', label: 'Popular' },
  { value: 'recent', label: 'Recent' },
] as const satisfies readonly { value: BucketSort; label: string }[];

export interface BucketListProps {
  /** The trip's saved places; undefined while the trip loads. */
  entries: BucketEntry[] | undefined;
  onSelect: (entry: BucketEntry) => void;
  onDelete: (entry: BucketEntry) => void;
  /** Smart Add: places the item in the best day and time. */
  onSmartAdd?: (entry: BucketEntry) => void;
  /** Plan my bucket list: places every item that fits (TR-32). */
  onPlanAll?: () => void;
  /** Suggest times for liked items (TR-64): set on a group trip with a liked item. */
  onSuggest?: () => void;
  /** Why an item stayed in the list after Plan my bucket list, by bucket item id. */
  notes?: Record<string, string>;
  /** Opens the Add sheet (search, or drop a pin). */
  onAdd: () => void;
  /** Toggles your like on an item (TR-59). */
  onLike?: (entry: BucketEntry) => void;
  /** Popular or Recent, and how to change it; the control shows with two or more items. */
  sort?: BucketSort;
  onSort?: (sort: BucketSort) => void;
  /** Room under the last row for the tab bar. */
  bottomInset: number;
}

/** The Bucket List segment of the Plan sheet: saved places without a day, and a way to add one. */
export function BucketList({
  entries,
  onSelect,
  onDelete,
  onSmartAdd,
  onPlanAll,
  onSuggest,
  notes,
  onAdd,
  onLike,
  sort,
  onSort,
  bottomInset,
}: BucketListProps) {
  const renderItem = useCallback(
    ({ item }: { item: BucketEntry }) => (
      <BucketRow
        entry={item}
        onPress={onSelect}
        onDelete={onDelete}
        note={notes?.[item.id]}
        onLike={onLike}
        action={onSmartAdd ? <SmartAddButton entry={item} onPress={onSmartAdd} /> : undefined}
      />
    ),
    [onSelect, onDelete, onSmartAdd, onLike, notes],
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

  const sorting = sort !== undefined && onSort !== undefined && entries.length > 1;
  const headerHeight =
    (sorting ? SORT_HEIGHT : 0) +
    (onPlanAll ? PLAN_ALL_HEIGHT : 0) +
    (onSuggest ? SUGGEST_HEIGHT : 0);
  const header =
    sorting || onPlanAll || onSuggest ? (
      <View>
        {sorting ? (
          <View style={styles.sort}>
            <Segmented segments={SORTS} value={sort} onChange={onSort} testID="bucket-sort" />
          </View>
        ) : null}
        {onPlanAll ? <PlanAllButton onPress={onPlanAll} /> : null}
        {onSuggest ? (
          <View style={styles.suggest}>
            <Button
              label="Suggest times for liked items"
              variant="secondary"
              icon="clock"
              onPress={onSuggest}
              testID="bucket-suggest"
            />
          </View>
        ) : null}
      </View>
    ) : null;
  return (
    <BottomSheetFlatList
      data={entries}
      extraData={notes}
      keyExtractor={(e: BucketEntry) => e.id}
      renderItem={renderItem}
      getItemLayout={(_: unknown, i: number) => ({
        length: BUCKET_ROW_HEIGHT,
        offset: headerHeight + BUCKET_ROW_HEIGHT * i,
        index: i,
      })}
      ListHeaderComponent={header ?? undefined}
      ListFooterComponent={add}
      contentContainerStyle={{ paddingBottom: bottomInset }}
      testID="bucket-list"
    />
  );
}

const styles = StyleSheet.create({
  sort: { height: SORT_HEIGHT, paddingTop: spacing.sm, paddingHorizontal: screenPadding },
  suggest: { height: SUGGEST_HEIGHT, paddingHorizontal: screenPadding, paddingBottom: spacing.md },
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
