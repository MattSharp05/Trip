import { StyleSheet, Switch, View } from 'react-native';

import type { BookingVisibility } from '@/services/data';
import { colors, continuous, radii, spacing } from '@/theme';
import { Icon, Text } from '@/ui';

/**
 * On the review screen for a group trip (TR-61): one row saying who will see the booking, with a
 * switch. The screen shows it only for a trip with others on it, where it means something.
 */
export function VisibilityRow({
  value,
  onChange,
}: {
  value: BookingVisibility;
  onChange: (value: BookingVisibility) => void;
}) {
  const shared = value === 'shared';
  return (
    <View style={styles.row} testID="import-visibility">
      <Icon name={shared ? 'person.2' : 'lock'} size="md" />
      <Text variant="body" style={styles.label}>
        {shared ? 'Shared with the group' : 'Only you'}
      </Text>
      <Switch
        value={shared}
        onValueChange={(on) => onChange(on ? 'shared' : 'private')}
        trackColor={{ true: colors.accent }}
        accessibilityLabel="Share with the group"
        testID="import-visibility-switch"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.card,
    ...continuous,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
  },
  label: { flex: 1 },
});
