import { Image } from 'expo-image';
import { memo, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';

import { watchLink } from '@/features/links/watch';
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
  /** Smart Add's button (TR-29). */
  action?: ReactNode;
  /** Why Plan my bucket list left it here (TR-32); shown instead of where it came from. */
  note?: string;
  /** Toggles your like (TR-59). */
  onLike?: (entry: BucketEntry) => void;
}

const likesLabel = (n: number) => `${n} ${n === 1 ? 'like' : 'likes'}`;

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
  note,
  onLike,
}: BucketRowProps) {
  // "Added by Blake · Saved from TikTok": on the short last line, so a long address can't hide it.
  const origin = [entry.addedBy, entry.source].filter(Boolean).join(' · ') || null;
  const spoken = [
    entry.title,
    entry.subtitle,
    note ?? origin,
    entry.likes ? likesLabel(entry.likes) : null,
  ]
    .filter(Boolean)
    .join(', ');
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
          {note ? (
            <Text
              variant="caption"
              tone="accent"
              numberOfLines={1}
              testID={`bucket-note-${entry.id}`}
            >
              {note}
            </Text>
          ) : origin ? (
            <Text
              variant="caption"
              tone="secondary"
              numberOfLines={1}
              testID={`bucket-origin-${entry.id}`}
            >
              {origin}
            </Text>
          ) : null}
        </View>
        {onLike ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={entry.likedByMe ? 'Unlike' : 'Like'}
            accessibilityValue={{ text: likesLabel(entry.likes) }}
            accessibilityState={{ selected: entry.likedByMe }}
            hitSlop={spacing.sm}
            onPress={() => onLike(entry)}
            style={({ pressed }) => [styles.like, pressed && styles.likePressed]}
            testID={`bucket-like-${entry.id}`}
          >
            <Icon
              name={entry.likedByMe ? 'heart.fill' : 'heart'}
              size="md"
              tone="secondary"
              selected={entry.likedByMe}
            />
            {entry.likes ? (
              <Text
                variant="subhead"
                tone={entry.likedByMe ? 'accent' : 'secondary'}
                style={styles.likeCount}
                testID={`bucket-likes-${entry.id}`}
              >
                {entry.likes}
              </Text>
            ) : null}
          </Pressable>
        ) : null}
        {action}
        {entry.watch ? (
          // Saved from a video (TR-30): the thumbnail is a play button that opens it.
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={entry.watch.label}
            onPress={() => entry.watch && watchLink(entry.watch.url)}
            hitSlop={spacing.md}
            style={({ pressed }) => [styles.thumb, pressed && styles.thumbPressed]}
            testID={`bucket-watch-${entry.id}`}
          >
            {entry.photo ? (
              <Image source={{ uri: entry.photo }} style={styles.photo} recyclingKey={entry.id} />
            ) : null}
            <View style={entry.photo ? styles.playOnPhoto : undefined}>
              <Icon name="play.fill" size="sm" />
            </View>
          </Pressable>
        ) : (
          <View style={styles.thumb}>
            {entry.photo ? (
              <Image source={{ uri: entry.photo }} style={styles.photo} recyclingKey={entry.id} />
            ) : (
              <Icon name={entry.symbol} size="md" tone="secondary" />
            )}
          </View>
        )}
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
  thumbPressed: { opacity: 0.7 },
  // Wide enough for "99" so a count appearing doesn't shift the row.
  like: {
    minWidth: 40,
    height: 32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
  },
  likePressed: { opacity: 0.6 },
  likeCount: { fontVariant: ['tabular-nums'] },
  photo: { width: '100%', height: '100%' },
  playOnPhoto: {
    position: 'absolute',
    width: 26,
    height: 26,
    borderRadius: radii.pill,
    backgroundColor: colors.backdrop,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
