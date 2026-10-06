import type { SFSymbol } from 'expo-symbols';
import { Pressable, StyleSheet, View } from 'react-native';

import { colors, continuous, radii, spacing } from '@/theme';

import { Icon } from './Icon';
import { Text } from './Text';

export interface ListRowProps {
  title: string;
  subtitle?: string;
  /** Leading SF Symbol, drawn in a small grey tile. */
  icon?: SFSymbol;
  /** Trailing text, e.g. an amount or a status. */
  value?: string;
  valueTone?: 'secondary' | 'ok' | 'accent';
  /** Shows a chevron and makes the row tappable. */
  onPress?: () => void;
  /** Draws a hairline under the row (rows stacked in one card). */
  separator?: boolean;
  testID?: string;
}

/** A row in a list card: icon, title and subtitle, value, chevron. */
export function ListRow({
  title,
  subtitle,
  icon,
  value,
  valueTone = 'secondary',
  onPress,
  separator = false,
  testID,
}: ListRowProps) {
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      disabled={!onPress}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.row,
        separator && styles.separator,
        pressed && styles.pressed,
      ]}
    >
      {icon ? (
        <View style={styles.tile}>
          <Icon name={icon} size="md" />
        </View>
      ) : null}
      <View style={styles.text}>
        <Text variant="body" style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="subhead" tone="secondary" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {value ? (
        <Text variant="body" tone={valueTone}>
          {value}
        </Text>
      ) : null}
      {onPress ? <Icon name="chevron.right" size="sm" tone="secondary" /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    minHeight: 56,
  },
  separator: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.hairline },
  pressed: { backgroundColor: colors.fill },
  tile: {
    width: 40,
    height: 40,
    borderRadius: radii.sm,
    ...continuous,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.raised,
  },
  text: { flex: 1, gap: spacing.xxs },
  title: { fontWeight: '500' },
});
