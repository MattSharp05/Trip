import type { SFSymbol } from 'expo-symbols';
import { StyleSheet, View } from 'react-native';

import { colors, continuous, radii, spacing } from '@/theme';
import { Icon, Text } from '@/ui';

/** A booking's name with its badge: a brand code (`HZ`) or the type's symbol. */
export function BookingHeader({
  badge,
  title,
  subtitle,
}: {
  badge: { code: string } | { icon: SFSymbol };
  title: string;
  subtitle?: string | null;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.badge}>
        {'code' in badge ? (
          <Text variant="subhead" style={styles.code} numberOfLines={1}>
            {badge.code}
          </Text>
        ) : (
          <Icon name={badge.icon} size="lg" />
        )}
      </View>
      <View style={styles.text}>
        <Text variant="title" numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="subhead" tone="secondary">
            {subtitle}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  badge: {
    width: 48,
    height: 48,
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
});
