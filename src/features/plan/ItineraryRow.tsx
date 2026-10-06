import { Image } from 'expo-image';
import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { colors, continuous, radii, screenPadding, spacing } from '@/theme';
import { Icon, Skeleton, Text } from '@/ui';

import type { ItineraryEntry } from './itinerary';

/** Every row is the same height, so the list can scroll to a row without measuring it. */
export const ROW_HEIGHT = 68;
const TIME_WIDTH = 68;
const RAIL_WIDTH = 20;
const NODE = 9;
const NODE_SELECTED = 13;
const THUMB = 44;
/** The node sits level with the title's first line. */
const NODE_TOP = spacing.md + 6;

export interface ItineraryRowProps {
  entry: ItineraryEntry;
  selected: boolean;
  /** Where the rail starts and ends: it joins the nodes, so it stops at the first and last. */
  first: boolean;
  last: boolean;
  onPress: (id: string) => void;
}

/**
 * One stop on the day's timeline: time, the orange rail with its node, title and place, and a
 * thumbnail (the place's photo or its kind's symbol). Selected: a lighter fill and a larger node.
 */
export const ItineraryRow = memo(function ItineraryRow({
  entry,
  selected,
  first,
  last,
  onPress,
}: ItineraryRowProps) {
  const spoken = [entry.time, entry.title, entry.subtitle].filter(Boolean).join(', ');
  const node = selected ? NODE_SELECTED : NODE;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={spoken}
      accessibilityHint="Shows it on the map"
      accessibilityState={{ selected }}
      onPress={() => onPress(entry.id)}
      testID={`itinerary-row-${entry.id}`}
      style={({ pressed }) => [styles.row, (selected || pressed) && styles.highlight]}
    >
      <Text
        variant="caption"
        tone={selected ? 'accent' : 'secondary'}
        numberOfLines={1}
        style={styles.time}
      >
        {entry.time ?? ''}
      </Text>
      <View style={styles.rail}>
        <View
          style={[styles.line, first && { top: NODE_TOP + NODE / 2 }, last && styles.lineEnd]}
        />
        <View
          testID={selected ? 'itinerary-node-selected' : undefined}
          style={[
            styles.node,
            {
              width: node,
              height: node,
              borderRadius: node / 2,
              top: NODE_TOP + (NODE - node) / 2,
            },
          ]}
        />
      </View>
      <View style={styles.text}>
        <Text variant="body" numberOfLines={1} style={styles.title}>
          {entry.title}
        </Text>
        {entry.subtitle ? (
          <Text variant="subhead" tone="secondary" numberOfLines={1}>
            {entry.subtitle}
          </Text>
        ) : null}
      </View>
      <View style={styles.thumb}>
        {entry.photo ? (
          <Image source={{ uri: entry.photo }} style={styles.photo} recyclingKey={entry.id} />
        ) : (
          <Icon name={entry.symbol} size="md" tone="secondary" />
        )}
      </View>
    </Pressable>
  );
});

/** A placeholder row while the trip loads. */
export function ItinerarySkeletonRow({ testID }: { testID?: string }) {
  return (
    <View style={styles.row} testID={testID}>
      <View style={styles.time}>
        <Skeleton width={52} height={12} />
      </View>
      <View style={styles.rail} />
      <View style={[styles.text, styles.skeletonText]}>
        <Skeleton width="70%" height={14} />
        <Skeleton width="45%" height={12} />
      </View>
      <Skeleton width={THUMB} height={THUMB} radius="sm" />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    height: ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: screenPadding - spacing.sm,
    marginHorizontal: spacing.sm,
    paddingTop: spacing.md,
    borderRadius: radii.card,
    ...continuous,
  },
  highlight: { backgroundColor: colors.fill },
  time: { width: TIME_WIDTH, paddingTop: 3 },
  // The rail spans the whole row (up into its top padding), so rows join into one line.
  rail: { width: RAIL_WIDTH, height: ROW_HEIGHT, marginTop: -spacing.md, alignItems: 'center' },
  line: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: StyleSheet.hairlineWidth * 2,
    backgroundColor: colors.accent,
  },
  lineEnd: { bottom: ROW_HEIGHT - NODE_TOP - NODE / 2 },
  node: { position: 'absolute', backgroundColor: colors.accent },
  text: { flex: 1, paddingLeft: spacing.sm, paddingRight: spacing.md, gap: spacing.xxs },
  title: { fontWeight: '600' },
  skeletonText: { gap: spacing.sm, paddingTop: 2 },
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
});
