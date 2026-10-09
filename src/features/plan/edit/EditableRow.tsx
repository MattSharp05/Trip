import type { SFSymbol } from 'expo-symbols';
import { memo, useMemo, useRef } from 'react';
import { Pressable, StyleSheet, View, type AccessibilityActionEvent } from 'react-native';
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable';
import Sortable from 'react-native-sortables';

import type { DistanceUnit } from '@/core/travel';
import { colors, continuous, radii, spacing } from '@/theme';
import { Icon, Text } from '@/ui';

import type { ItineraryEntry } from '../itinerary';
import { ItineraryRow } from '../ItineraryRow';
import { TravelLeg } from '../TravelLeg';

const ACTION_WIDTH = 72;
/** The drag handle's column in Edit mode: a full 44 pt touch target. */
const HANDLE_WIDTH = 44;

/** What the timeline does with edit gestures (the Plan screen's `useItineraryEditor`). */
export interface ItineraryEditing {
  /** Drop the row at `from` onto the row at `to`; false when it was refused or changed nothing. */
  onReorder: (from: number, to: number) => boolean;
  onTimePress: (id: string) => void;
  onEdit: (id: string) => void;
  onMoveDay: (id: string) => void;
  onDelete: (id: string) => void;
}

export interface EditableRowProps {
  entry: ItineraryEntry;
  index: number;
  count: number;
  selected: boolean;
  unit: DistanceUnit;
  onSelect: (id: string) => void;
  editing: ItineraryEditing;
  /** Edit mode: a drag handle on the right moves the row straight away; no swipe actions. */
  reordering?: boolean;
}

/**
 * An itinerary row you can edit, drawn inside the itinerary's sortable list (`Itinerary`, which
 * owns touch and hold, then drag, through react-native-sortables, ADR 0024): swipe left for Edit,
 * Move (another day) and Delete; tap the time to change it; in Edit mode, drag the handle. VoiceOver
 * gets the same as actions.
 */
export const EditableRow = memo(function EditableRow({
  entry,
  index,
  count,
  selected,
  unit,
  onSelect,
  editing,
  reordering = false,
}: EditableRowProps) {
  const swipeable = useRef<SwipeableMethods>(null);

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
    <View style={styles.item}>
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
            <Sortable.Handle>
              <View
                style={styles.handle}
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                testID={`itinerary-handle-${entry.id}`}
              >
                <Icon name="line.3.horizontal" size="md" tone="secondary" />
              </View>
            </Sortable.Handle>
          ) : null}
        </View>
      </ReanimatedSwipeable>
      {entry.leg ? (
        <TravelLeg leg={entry.leg} unit={unit} testID={`travel-leg-${entry.id}`} />
      ) : null}
    </View>
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
  // Opaque, so the lifted row (row and leg) covers the rows it passes.
  item: { backgroundColor: colors.surface },
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
