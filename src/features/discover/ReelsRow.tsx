import { Image } from 'expo-image';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import type { CityReel } from '@/services/cityLinks';
import { colors, continuous, radii, screenPadding, spacing } from '@/theme';
import { Icon, Text } from '@/ui';

import { placesLabel, viewLabel } from './reels';

export const REEL_WIDTH = 108;
const THUMB_HEIGHT = 144;

export interface ReelsRowProps {
  reels: readonly CityReel[];
  /** Opens the video's places (the TR-30 results sheet). */
  onOpen: (reel: CityReel) => void;
  testID: string;
}

/**
 * Discover's "Saved from TikTok & Reels" row (TR-34): tall video thumbnails with a play mark and
 * the view count when known, the caption and how many places it names. No platform logos.
 * Reel test IDs are `<testID>-reel-<index>`.
 */
export function ReelsRow({ reels, onOpen, testID }: ReelsRowProps) {
  return (
    <FlatList
      horizontal
      data={reels}
      keyExtractor={(r) => r.url}
      renderItem={({ item, index }) => (
        <Reel reel={item} onPress={() => onOpen(item)} testID={`${testID}-reel-${index}`} />
      )}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      style={styles.bleed}
      snapToInterval={REEL_WIDTH + spacing.md}
      decelerationRate="fast"
      testID={testID}
    />
  );
}

function Reel({ reel, onPress, testID }: { reel: CityReel; onPress: () => void; testID: string }) {
  const title = reel.title ?? 'Saved video';
  const places = placesLabel(reel.placeCount);
  const views = reel.viewCount !== null ? viewLabel(reel.viewCount) : null;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${places}${views ? `, ${views} views` : ''}`}
      accessibilityHint="Shows the places in this video"
      style={({ pressed }) => [styles.reel, pressed && styles.pressed]}
      testID={testID}
    >
      <View style={styles.thumb}>
        {reel.thumbnailUrl ? (
          <Image
            source={{ uri: reel.thumbnailUrl }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={200}
          />
        ) : (
          <Icon name="film" size="lg" tone="secondary" />
        )}
        <View style={styles.badge}>
          <Icon name="play.fill" size="sm" />
          {views ? (
            <Text variant="caption" style={styles.badgeText} testID={`${testID}-views`}>
              {views}
            </Text>
          ) : null}
        </View>
      </View>
      <Text variant="subhead" style={styles.title} numberOfLines={2}>
        {title}
      </Text>
      <Text variant="caption" tone="secondary" numberOfLines={1}>
        {places}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  /** Rows scroll edge to edge while their first reel lines up with the screen margin. */
  bleed: { marginHorizontal: -screenPadding },
  row: { gap: spacing.md, paddingHorizontal: screenPadding },
  reel: { width: REEL_WIDTH, gap: spacing.xxs },
  pressed: { opacity: 0.7 },
  thumb: {
    height: THUMB_HEIGHT,
    borderRadius: radii.card,
    ...continuous,
    overflow: 'hidden',
    backgroundColor: colors.raised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xxs,
  },
  badge: {
    position: 'absolute',
    left: spacing.xs,
    bottom: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
    paddingHorizontal: spacing.xs,
    height: 20,
    borderRadius: radii.pill,
    backgroundColor: colors.backdrop,
  },
  badgeText: { fontWeight: '600' },
  title: { fontWeight: '600' },
});
