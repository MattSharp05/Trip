import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { colors, continuous, radii, spacing } from '@/theme';
import { Icon, IconButton, Skeleton, Text } from '@/ui';

import type { DiscoverCard } from './discover';

export const CARD_WIDTH = 156;
const PHOTO_HEIGHT = 96;

export interface DiscoverCardViewProps {
  card: DiscoverCard;
  /** Saves the card to the Bucket List; only offered while it's new. */
  onAdd: () => void;
  /** While its save is on the way: the `+` waits. */
  saving?: boolean;
  testID?: string;
}

/**
 * An event or place on Discover: photo, title, two quiet lines (when and where), and the orange
 * `+` that saves it. Saved cards show a check; cards already in the itinerary say "Planned".
 */
export function DiscoverCardView({ card, onAdd, saving = false, testID }: DiscoverCardViewProps) {
  return (
    <View style={styles.card} testID={testID}>
      <View style={styles.photo}>
        {card.imageUrl ? (
          <Image
            source={{ uri: card.imageUrl }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={200}
          />
        ) : (
          <Icon name={card.symbol} size="lg" tone="secondary" />
        )}
        {card.tag ? (
          <View style={styles.tag} testID={testID ? `${testID}-tag` : undefined}>
            <Text variant="caption" style={styles.tagText}>
              {card.tag}
            </Text>
          </View>
        ) : null}
      </View>
      <View style={styles.body}>
        <View style={styles.text}>
          <Text variant="subhead" style={styles.title} numberOfLines={1}>
            {card.title}
          </Text>
          {card.line1 ? (
            <Text variant="caption" tone="secondary" numberOfLines={1}>
              {card.line1}
            </Text>
          ) : null}
          {card.line2 ? (
            <Text variant="caption" tone="secondary" numberOfLines={1}>
              {card.line2}
            </Text>
          ) : null}
        </View>
        <View style={styles.action}>
          {card.state === 'planned' ? (
            <View style={styles.planned} testID={testID ? `${testID}-planned` : undefined}>
              <Text variant="caption" tone="secondary">
                Planned
              </Text>
            </View>
          ) : card.state === 'saved' ? (
            <View
              style={styles.saved}
              accessible
              accessibilityLabel="Saved to your Bucket List"
              testID={testID ? `${testID}-saved` : undefined}
            >
              <Icon name="checkmark" size="sm" weight="semibold" />
            </View>
          ) : (
            <IconButton
              icon="plus"
              label={`Save ${card.title} to your Bucket List`}
              variant="filled"
              size="sm"
              onPress={saving ? undefined : onAdd}
              testID={testID ? `${testID}-add` : undefined}
            />
          )}
        </View>
      </View>
    </View>
  );
}

/** A card's shape while events load. */
export function DiscoverCardSkeleton({ testID }: { testID?: string }) {
  return <Skeleton width={CARD_WIDTH} height={PHOTO_HEIGHT + 64} radius="card" testID={testID} />;
}

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    borderRadius: radii.card,
    ...continuous,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
  },
  photo: {
    height: PHOTO_HEIGHT,
    backgroundColor: colors.raised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tag: {
    position: 'absolute',
    top: spacing.xs,
    left: spacing.xs,
    paddingHorizontal: spacing.sm,
    height: 20,
    justifyContent: 'center',
    borderRadius: radii.pill,
    backgroundColor: colors.backdrop,
  },
  tagText: { fontWeight: '600' },
  body: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.xs,
    padding: spacing.sm,
    minHeight: 64,
  },
  text: { flex: 1, gap: 1 },
  title: { fontWeight: '600' },
  action: { minWidth: 28, alignItems: 'flex-end' },
  saved: {
    width: 28,
    height: 28,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.fill,
  },
  planned: {
    paddingHorizontal: spacing.sm,
    height: 22,
    justifyContent: 'center',
    borderRadius: radii.pill,
    backgroundColor: colors.fill,
  },
});
