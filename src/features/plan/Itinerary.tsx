import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedRef } from 'react-native-reanimated';
import Sortable, {
  type SortableGridDragEndParams,
  type SortableGridRenderItem,
} from 'react-native-sortables';

import type { DistanceUnit } from '@/core/travel';
import { useDistanceUnit } from '@/features/settings';
import { screenPadding, spacing } from '@/theme';
import { Button, Text } from '@/ui';

import { drop, HOLD_SLOP, LONG_PRESS_MS } from './edit/drag';
import { EditableRow, type ItineraryEditing } from './edit/EditableRow';
import type { ItineraryEntry } from './itinerary';
import { ItineraryRow, ItinerarySkeletonRow, ROW_HEIGHT } from './ItineraryRow';
import { LEG_HEIGHT, TravelLeg } from './TravelLeg';

const SKELETON_ROWS = 4;
/** Where a revealed row lands: a third of the way down the visible list. */
const REVEAL_POSITION = 0.3;
/** The lifted row grows a little, like a card picked up off the table. */
const LIFT_SCALE = 1.03;
const DROP_MS = 200;

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
  /** Edit gestures (drag, swipe, time); without it the rows are read-only. */
  editing?: ItineraryEditing;
  /** Edit mode: each row shows a drag handle (DayHeader's Edit / Done). */
  reordering?: boolean;
}

/** A row plus, under it, the travel leg to the next stop when there is one. */
const itemHeight = (entry: ItineraryEntry) => ROW_HEIGHT + (entry.leg ? LEG_HEIGHT : 0);
const entryKey = (entry: ItineraryEntry) => entry.id;

/**
 * The day's timeline inside the Plan sheet, with the estimated travel between stops, a free-day
 * state and skeleton rows. While editing, the rows sit in a react-native-sortables list (ADR 0024):
 * touch and hold a row to lift it, drag it, and let go to reorder the day.
 */
export function Itinerary({
  entries,
  selectedId,
  revealKey,
  reveal,
  onSelect,
  onOpenBucketList,
  bottomInset,
  editing,
  reordering = false,
}: ItineraryProps) {
  const scroll = useAnimatedRef<Animated.ScrollView>();
  const [viewHeight, setViewHeight] = useState(0);
  const unit = useDistanceUnit();
  const index = entries && selectedId ? entries.findIndex((e) => e.id === selectedId) : -1;

  // Rows with a leg under them are taller: offsets add up the heights before each row.
  const offsets = useMemo(() => {
    const result = [0];
    for (const entry of entries ?? []) result.push(result[result.length - 1] + itemHeight(entry));
    return result;
  }, [entries]);

  const revealed = useRef(revealKey);
  useEffect(() => {
    if (revealed.current === revealKey) return;
    revealed.current = revealKey;
    if (reveal && index >= 0) {
      const height = offsets[index + 1] - offsets[index];
      const y = offsets[index] - REVEAL_POSITION * Math.max(0, viewHeight - height);
      scroll.current?.scrollTo({ y: Math.max(0, y), animated: true });
    }
  }, [revealKey, reveal, index, offsets, viewHeight, scroll]);

  const { lifted, sortable } = useReorder(editing, reordering);

  const renderItem = useCallback<SortableGridRenderItem<ItineraryEntry>>(
    ({ item, index: i }) =>
      editing ? (
        <EditableRow
          entry={item}
          index={i}
          count={entries?.length ?? 0}
          selected={item.id === selectedId}
          unit={unit}
          onSelect={onSelect}
          editing={editing}
          reordering={reordering}
        />
      ) : null,
    [selectedId, entries, onSelect, unit, editing, reordering],
  );

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
    <BottomSheetScrollView
      ref={scroll}
      scrollEnabled={!lifted}
      onLayout={(e: LayoutChangeEvent) => setViewHeight(e.nativeEvent.layout.height)}
      contentContainerStyle={{ paddingBottom: bottomInset }}
      testID="itinerary-list"
    >
      {editing ? (
        <Sortable.Grid
          // Edit mode swaps how a drag starts (the handle, at once); a refused drop puts the rows
          // back in the day's order. Both rebuild the list.
          key={sortable.key}
          columns={1}
          data={entries}
          keyExtractor={entryKey}
          renderItem={renderItem}
          customHandle={reordering}
          dragActivationDelay={reordering ? 0 : LONG_PRESS_MS}
          dragActivationFailOffset={HOLD_SLOP}
          activeItemScale={LIFT_SCALE}
          inactiveItemOpacity={1}
          dropAnimationDuration={DROP_MS}
          overDrag="vertical"
          itemEntering={null}
          itemExiting={null}
          itemsLayoutTransitionMode="reorder"
          scrollableRef={scroll}
          onDragStart={sortable.onDragStart}
          onOrderChange={sortable.onOrderChange}
          onDragEnd={sortable.onDragEnd}
        />
      ) : (
        entries.map((item, i) => (
          <ReadOnlyRow
            key={item.id}
            entry={item}
            index={i}
            count={entries.length}
            selected={item.id === selectedId}
            unit={unit}
            onSelect={onSelect}
          />
        ))
      )}
    </BottomSheetScrollView>
  );
}

/** A row and its travel leg, without edit gestures. */
function ReadOnlyRow({
  entry,
  index,
  count,
  selected,
  unit,
  onSelect,
}: {
  entry: ItineraryEntry;
  index: number;
  count: number;
  selected: boolean;
  unit: DistanceUnit;
  onSelect: (id: string) => void;
}) {
  return (
    <>
      <ItineraryRow
        entry={entry}
        selected={selected}
        first={index === 0}
        last={index === count - 1}
        onPress={onSelect}
      />
      {entry.leg ? (
        <TravelLeg leg={entry.leg} unit={unit} testID={`travel-leg-${entry.id}`} />
      ) : null}
    </>
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

/**
 * The sortable list's callbacks (TR-24 QA round 4): a medium haptic tap when a row lifts, a tick
 * for each row it passes, and on release `editing.onReorder`. A refused drop buzzes a warning and
 * puts the rows back (the list keeps its own order, so it's rebuilt from the day's entries); an
 * accepted one stays where it was dropped and the reordered entries take over. The list doesn't
 * scroll while a row is lifted.
 */
function useReorder(editing: ItineraryEditing | undefined, reordering: boolean) {
  const [resets, setResets] = useState(0);
  /** The list's build: Edit / Done and a refused drop rebuild it. */
  const key = `${reordering ? 'handles' : 'hold'}:${resets}`;
  // The build a row was lifted in: a drag cut short by a rebuild never reports its end.
  const [liftedIn, setLiftedIn] = useState<string | null>(null);
  // Read at drop time, so a drag that started before a re-render saves through the latest editor.
  const onReorder = useRef(editing?.onReorder);
  useEffect(() => {
    onReorder.current = editing?.onReorder;
  });

  const sortable = useMemo(
    () => ({
      key,
      onDragStart: () => {
        setLiftedIn(key);
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      },
      onOrderChange: () => {
        void Haptics.selectionAsync();
      },
      onDragEnd: ({ fromIndex, toIndex }: SortableGridDragEndParams<ItineraryEntry>) => {
        setLiftedIn(null);
        const reorder = onReorder.current;
        if (!reorder) return;
        if (drop(fromIndex, toIndex, reorder) === 'refused') {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          setResets((n) => n + 1);
        }
      },
    }),
    [key],
  );
  return { lifted: liftedIn === key, sortable };
}
