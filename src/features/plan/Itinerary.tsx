import { BottomSheetFlatList, type BottomSheetFlatListMethods } from '@gorhom/bottom-sheet';
import * as Haptics from 'expo-haptics';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';
import { useSharedValue, withTiming } from 'react-native-reanimated';

import { useDistanceUnit } from '@/features/settings';
import { screenPadding, spacing } from '@/theme';
import { Button, Text } from '@/ui';

import { dropIndex } from './edit/drag';
import { EditableRow, type DragState, type ItineraryEditing } from './edit/EditableRow';
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
  /** Edit gestures (drag, swipe, time); without it the rows are read-only. */
  editing?: ItineraryEditing;
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
  editing,
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

  // Rows with a leg under them are taller: offsets add up the heights before each row.
  const offsets = useMemo(() => {
    const result = [0];
    for (const entry of entries ?? []) result.push(result[result.length - 1] + itemHeight(entry));
    return result;
  }, [entries]);

  const { drag, lifted } = useDrag(offsets, entries, editing);

  const renderItem = useCallback(
    ({ item, index: i }: { item: ItineraryEntry; index: number }) =>
      editing ? (
        <EditableRow
          entry={item}
          index={i}
          count={entries?.length ?? 0}
          selected={item.id === selectedId}
          unit={unit}
          onSelect={onSelect}
          editing={editing}
          drag={drag}
        />
      ) : (
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
    [selectedId, entries, onSelect, unit, editing, drag],
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
    <LiftedRow.Provider value={lifted}>
      <BottomSheetFlatList
        ref={list}
        data={entries}
        keyExtractor={(e: ItineraryEntry) => e.id}
        renderItem={renderItem}
        extraData={`${selectedId}:${unit}`}
        scrollEnabled={lifted === null}
        CellRendererComponent={editing ? Cell : undefined}
        getItemLayout={(_: unknown, i: number) => ({
          length: offsets[i + 1] - offsets[i],
          offset: offsets[i],
          index: i,
        })}
        contentContainerStyle={{ paddingBottom: bottomInset }}
        testID="itinerary-list"
      />
    </LiftedRow.Provider>
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
  liftedCell: { zIndex: 1 },
});

const SNAP_BACK_MS = 150;

/** The lifted row's index, for its cell. */
const LiftedRow = createContext<number | null>(null);

/** A list cell; the lifted row's draws over the rows it passes. Stable, so cells never remount. */
function Cell({
  index,
  style,
  onLayout,
  children,
}: ViewProps & { index: number; children?: ReactNode }) {
  const lifted = useContext(LiftedRow);
  return (
    <View style={[style, index === lifted && styles.liftedCell]} onLayout={onLayout}>
      {children}
    </View>
  );
}

/**
 * The drag shared by the rows: lifts a row (with a haptic tap), follows the finger, ticks as it
 * passes rows, and on release asks `editing.onReorder`. A refused or empty drop slides back; an
 * accepted one stays put until the reordered entries arrive.
 */
function useDrag(
  offsets: number[],
  entries: ItineraryEntry[] | undefined,
  editing: ItineraryEditing | undefined,
): { drag: DragState; lifted: number | null } {
  const from = useSharedValue(-1);
  const dy = useSharedValue(0);
  const shared = useSharedValue(offsets);
  const [lifted, setLifted] = useState<number | null>(null);
  const over = useRef(-1);
  // Read at drop time: the rows' gestures keep one drag object while they're held.
  const onReorder = useRef(editing?.onReorder);
  useEffect(() => {
    onReorder.current = editing?.onReorder;
  });

  useEffect(() => {
    shared.set(offsets);
  }, [offsets, shared]);

  // New entries (the drop was saved): the rows are in their new places.
  useEffect(() => {
    from.set(-1);
    dy.set(0);
  }, [entries, from, dy]);

  const drag = useMemo((): DragState => {
    const settle = () => {
      dy.set(
        withTiming(0, { duration: SNAP_BACK_MS }, (finished) => {
          if (finished) from.set(-1);
        }),
      );
      setLifted(null);
    };
    return {
      from,
      dy,
      offsets: shared,
      start: (index: number) => {
        over.current = index;
        from.set(index);
        dy.set(0);
        setLifted(index);
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      },
      move: (y: number) => {
        dy.set(y);
        const to = dropIndex(shared.get(), from.get(), y);
        if (to !== over.current) {
          over.current = to;
          void Haptics.selectionAsync();
        }
      },
      end: (dropped: boolean) => {
        const index = from.get();
        // New entries arrived mid-drag and reset it: just let go.
        if (index < 0) return setLifted(null);
        const to = dropIndex(shared.get(), index, dy.get());
        if (dropped && to !== index && onReorder.current?.(index, to)) {
          setLifted(null);
          return;
        }
        if (dropped && to !== index) {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        }
        settle();
      },
    };
  }, [from, dy, shared]);
  return { drag, lifted };
}
