import { Image } from 'expo-image';
import { memo, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';

import { colors, continuous, radii, screenPadding, spacing } from '@/theme';
import { Icon, Text } from '@/ui';

import type { BucketEntry } from './bucket';

/** Every row is the same height, like the itinerary's. */
export const BUCKET_ROW_HEIGHT = 76;
const THUMB = 44;
const DELETE_WIDTH = 88;

export interface BucketRowProps {
  entry: BucketEntry;
  onPress: (entry: BucketEntry) => void;
  onDelete: (entry: BucketEntry) => void;
  /** Smart Add's button (TR-29); nothing until then. */
  action?: ReactNode;
}

/**
 * One saved place, drawn like an itinerary row: name, area and kind, where it came from, and its
 * photo or kind symbol. Swipe
 * left to delete (VoiceOver: the Delete action).
 */
export const BucketRow = memo(function BucketRow({
  entry,
  onPress,
  onDelete,
  action,
}: BucketRowProps) {
  const spoken = [entry.title, entry.subtitle, entry.source].filter(Boolean).join(', ');
  return (
    <ReanimatedSwipeable
      friction={2}
      rightThreshold={DELETE_WIDTH / 2}
      overshootRight={false}
      renderRightActions={() => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Delete ${entry.title}`}
          onPress={() => onDelete(entry)}
          style={styles.delete}
          testID={`bucket-delete-${entry.id}`}
        >
          <Icon name="trash" size="md" tone="onAccent" />
          <Text variant="caption" tone="onAccent">
            Delete
          </Text>
        </Pressable>
      )}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={spoken}
        accessibilityHint="Shows it on the map"
        accessibilityActions={[{ name: 'delete', label: 'Delete' }]}
        onAccessibilityAction={(e) => {
          if (e.nativeEvent.actionName === 'delete') onDelete(entry);
        }}
        onPress={() => onPress(entry)}
        testID={`bucket-row-${entry.id}`}
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      >
        <View style={styles.text}>
          <Text variant="body" numberOfLines={1} style={styles.title}>
            {entry.title}
          </Text>
          {entry.subtitle ? (
            <Text variant="subhead" tone="secondary" numberOfLines={1}>
              {entry.subtitle}
            </Text>
          ) : null}
          {entry.source ? (
            <Text variant="caption" tone="secondary" numberOfLines={1}>
              {entry.source}
            </Text>
          ) : null}
        </View>
        {action}
        <View style={styles.thumb}>
          {entry.photo ? (
            <Image source={{ uri: entry.photo }} style={styles.photo} recyclingKey={entry.id} />
          ) : (
            <Icon name={entry.symbol} size="md" tone="secondary" />
          )}
        </View>
      </Pressable>
    </ReanimatedSwipeable>
  );
});

const styles = StyleSheet.create({
  row: {
    height: BUCKET_ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: screenPadding - spacing.sm,
    marginHorizontal: spacing.sm,
    borderRadius: radii.card,
    ...continuous,
    backgroundColor: colors.surface,
  },
  pressed: { backgroundColor: colors.fill },
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: radii.sm,
    ...continuous,
    overflow: 'hidden',
    backgroundColor: colors.raised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photo: { width: '100%', height: '100%' },
  text: { flex: 1, gap: spacing.xxs },
  title: { fontWeight: '600' },
  delete: {
    width: DELETE_WIDTH,
    marginRight: spacing.sm,
    borderRadius: radii.card,
    ...continuous,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xxs,
  },
});
