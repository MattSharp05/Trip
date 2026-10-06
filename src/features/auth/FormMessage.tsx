import { StyleSheet, View } from 'react-native';

import { colors, continuous, radii, spacing } from '@/theme';
import { Icon, Text } from '@/ui';

/** A form-level error (wrong password, offline…) above the submit button. */
export function FormMessage({ message, testID }: { message: string; testID?: string }) {
  return (
    <View style={styles.box} accessibilityRole="alert" accessibilityLiveRegion="polite">
      <Icon name="exclamationmark.circle" size="sm" />
      <Text variant="subhead" style={styles.text} testID={testID}>
        {message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.card,
    ...continuous,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
  },
  text: { flex: 1 },
});
