import type { SFSymbol } from 'expo-symbols';
import { memo, useMemo, useRef } from 'react';
import { Pressable, StyleSheet, View, type AccessibilityActionEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, { useAnimatedStyle, withTiming, type SharedValue } from 'react-native-reanimated';

import type { DistanceUnit } from '@/core/travel';
import { colors, continuous, radii, spacing } from '@/theme';
import { Icon, Text } from '@/ui';

import type { ItineraryEntry } from '../itinerary';
import { ItineraryRow } from '../ItineraryRow';
import { TravelLeg } from '../TravelLeg';
import { dragShift, dropIndex } from './drag';

/** Hold this long before a row lifts and follows the finger (iOS's own long-press time). */
export const LONG_PRESS_MS = 350;
const ACTION_WIDTH = 72;
/** The drag handle's column in Edit mode: a full 44 pt touch target. */
const HANDLE_WIDTH = 44;
const SHIFT_MS = 150;

/** What the timeline does with edit gestures (the Plan screen's `useItineraryEditor`). */
export interface ItineraryEditing {
  /** Drop the row at `from` onto the row at `to`; false when it was refused or changed nothing. */
  onReorder: (from: number, to: number) => boolean;
  onTimePress: (id: string) => void;
  onEdit: (id: string) => void;
  onMoveDay: (id: string) => void;
  onDelete: (id: string) => void;
}

/** The drag in progress, shared by every row: which row is lifted and how far it moved. */
export interface DragState {
  /** The lifted row's index; -1 when nothing is being dragged. */
  from: SharedValue<number>;
  dy: SharedValue<number>;
  /** Where each row starts, plus the list's end (`Itinerary`'s layout). */
  offsets: SharedValue<number[]>;
  start: (index: number) => void;
  move: (dy: number) => void;
  end: (dropped: boolean) => void;
}

export interface EditableRowProps {
  entry: ItineraryEntry;
  index: number;
  count: number;
  selected: boolean;
  unit: DistanceUnit;
  onSelect: (id: string) => void;
  editing: ItineraryEditing;
  drag: DragState;
  /** Edit mode: a drag handle on the right moves the row straight away; no swipe actions. */
  reordering?: boolean;
}

/**
 * An itinerary row you can edit: touch and hold to lift it and drag it to another place in the
 * day (or, in Edit mode, drag its handle); swipe left for Edit, Move (another day) and Delete; tap
 * the time to change it. VoiceOver gets the same as actions.
 */
export const EditableRow = memo(function EditableRow({
  entry,
  index,
  count,
  selected,
  unit,
  onSelect,
  editing,
  drag,
  reordering = false,
}: EditableRowProps) {
  const swipeable = useRef<SwipeableMethods>(null);

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .enabled(!reordering)
        .activateAfterLongPress(LONG_PRESS_MS)
        .runOnJS(true)
        .withTestId(`itinerary-drag-${entry.id}`)
        .onStart(() => drag.start(index))
        .onUpdate((e) => drag.move(e.translationY))
        .onEnd((_e, success) => drag.end(success)),
    [drag, index, entry.id, reordering],
  );

  // The handle's drag starts on the first movement, like the swipe, so it's ahead of the sheet's
  // own pan and the list's scroll (which wait for about 10 pt) and needs no hold (TR-24 QA round 2:
  // the touch-and-hold drag never lifted inside the Plan sheet on device).
  const handlePan = useMemo(
    () =>
      Gesture.Pan()
        .minDistance(0)
        .shouldCancelWhenOutside(false)
        .runOnJS(true)
        .withTestId(`itinerary-handle-${entry.id}`)
        .onStart(() => drag.start(index))
        .onUpdate((e) => drag.move(e.translationY))
        .onEnd((_e, success) => drag.end(success)),
    [drag, index, entry.id],
  );

  const lifted = useAnimatedStyle(() => {
    const from = drag.from.get();
    if (from < 0) return { transform: [{ translateY: 0 }, { scale: 1 }], opacity: 1 };
    if (from === index) {
      return { transform: [{ translateY: drag.dy.get() }, { scale: 1.02 }], opacity: 0.95 };
    }
    const offsets = drag.offsets.get();
    const shift = dragShift(offsets, from, dropIndex(offsets, from, drag.dy.get()), index);
    return {
      transform: [{ translateY: withTiming(shift, { duration: SHIFT_MS }) }, { scale: 1 }],
      opacity: 1,
    };
  });

  const act = (run: (id: string) => void) => () => {
    swipeable.current?.close();
    run(entry.id);
  };

  const actions = useMemo(
    () => [
      ...(index > 0 ? [{ name: 'moveEarlier', label: 'Move earlier' }] : []),
      ...(index < count - 1 ? [{ name: 'moveLater', label: 'Move later' }] : []),
      { name: 'edit', label: 'Edit' },
      { name: 'moveDay', label: 'Move to another day' },
      { name: 'delete', label: 'Delete' },
    ],
    [index, count],
  );
  const onAction = (e: AccessibilityActionEvent) => {
    switch (e.nativeEvent.actionName) {
      case 'moveEarlier':
        editing.onReorder(index, index - 1);
        break;
      case 'moveLater':
        editing.onReorder(index, index + 1);
        break;
      case 'edit':
        editing.onEdit(entry.id);
        break;
      case 'moveDay':
        editing.onMoveDay(entry.id);
        break;
      case 'delete':
        editing.onDelete(entry.id);
        break;
    }
  };

  return (
    <Animated.View style={lifted}>
      <ReanimatedSwipeable
        ref={swipeable}
        enabled={!reordering}
        friction={2}
        rightThreshold={ACTION_WIDTH}
        overshootRight={false}
        renderRightActions={() => (
          <View style={styles.actions}>
            <SwipeAction
              icon="pencil"
              label="Edit"
              onPress={act(editing.onEdit)}
              testID={`itinerary-edit-${entry.id}`}
            />
            <SwipeAction
              icon="calendar"
              label="Move"
              onPress={act(editing.onMoveDay)}
              testID={`itinerary-move-${entry.id}`}
            />
            <SwipeAction
              icon="trash"
              label="Delete"
              accent
              onPress={act(editing.onDelete)}
              testID={`itinerary-delete-${entry.id}`}
            />
          </View>
        )}
      >
        <GestureDetector gesture={pan}>
          <View style={styles.row}>
            <View style={styles.main}>
              <ItineraryRow
                entry={entry}
                selected={selected}
                first={index === 0}
                last={index === count - 1}
                onPress={onSelect}
                onTimePress={editing.onTimePress}
                accessibilityActions={actions}
                onAccessibilityAction={onAction}
              />
            </View>
            {reordering ? (
              <GestureDetector gesture={handlePan}>
                <View
                  style={styles.handle}
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                  testID={`itinerary-handle-${entry.id}`}
                >
                  <Icon name="line.3.horizontal" size="md" tone="secondary" />
                </View>
              </GestureDetector>
            ) : null}
          </View>
        </GestureDetector>
      </ReanimatedSwipeable>
      {entry.leg ? (
        <TravelLeg leg={entry.leg} unit={unit} testID={`travel-leg-${entry.id}`} />
      ) : null}
    </Animated.View>
  );
});

function SwipeAction({
  icon,
  label,
  accent = false,
  onPress,
  testID,
}: {
  icon: SFSymbol;
  label: string;
  accent?: boolean;
  onPress: () => void;
  testID: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={[styles.action, accent ? styles.accent : styles.plain]}
      testID={testID}
    >
      <Icon name={icon} size="md" tone={accent ? 'onAccent' : 'primary'} />
      <Text variant="caption" tone={accent ? 'onAccent' : 'primary'}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // The swipe reveals the actions behind an opaque row.
  row: { backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'stretch' },
  main: { flex: 1 },
  handle: {
    width: HANDLE_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  actions: { flexDirection: 'row', gap: spacing.xs, marginRight: spacing.sm },
  action: {
    width: ACTION_WIDTH,
    borderRadius: radii.card,
    ...continuous,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xxs,
  },
  plain: { backgroundColor: colors.raised },
  accent: { backgroundColor: colors.accent },
});
