import type { SFSymbol } from 'expo-symbols';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { colors, continuous, radii, spacing } from '@/theme';
import { Icon, Text } from '@/ui';

export type WalletBadge = { code: string } | { icon: SFSymbol };

export interface WalletCardProps {
  /** A brand code (airline, rental company) or an SF Symbol for the booking type. */
  badge: WalletBadge;
  title: string;
  /** Up to two grey lines under the title. */
  lines: readonly string[];
  /** Shown before the chevron, e.g. a flight's live status pill. */
  accessory?: ReactNode;
  /** Makes the card tappable and shows a chevron. */
  onPress?: () => void;
  testID?: string;
}

/** The shared shell of every wallet card: badge, title and detail lines, chevron. */
export function WalletCard({ badge, title, lines, accessory, onPress, testID }: WalletCardProps) {
  const content = (
    <>
      <View style={styles.badge}>
        {'code' in badge ? (
          <Text variant="subhead" style={styles.code} numberOfLines={1}>
            {badge.code}
          </Text>
        ) : (
          <Icon name={badge.icon} size="md" />
        )}
      </View>
      <View style={styles.text}>
        <Text variant="body" style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {lines.map((line, i) => (
          <Text key={i} variant="subhead" tone="secondary" numberOfLines={1}>
            {line}
          </Text>
        ))}
      </View>
      {accessory}
      {onPress ? <Icon name="chevron.right" size="sm" tone="secondary" /> : null}
    </>
  );

  if (!onPress) {
    return (
      <View style={styles.card} testID={testID}>
        {content}
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[title, ...lines].join(', ')}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.card,
    ...continuous,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
  },
  pressed: { backgroundColor: colors.raised },
  badge: {
    width: 40,
    height: 40,
    borderRadius: radii.sm,
    ...continuous,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.raised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
  },
  code: { fontWeight: '700', letterSpacing: 0.5 },
  text: { flex: 1, gap: spacing.xxs },
  title: { fontWeight: '600' },
});
