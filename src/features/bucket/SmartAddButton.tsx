import { Pressable, StyleSheet } from 'react-native';

import { colors, continuous, radii, spacing } from '@/theme';
import { Text } from '@/ui';

import type { BucketEntry } from './bucket';

export interface SmartAddButtonProps {
  entry: BucketEntry;
  onPress: (entry: BucketEntry) => void;
}

/** "Smart Add" on a Bucket List row: Smart Add puts the place in the best day and time (TR-29). */
export function SmartAddButton({ entry, onPress }: SmartAddButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Smart Add ${entry.title}`}
      accessibilityHint="Adds it to the best day and time in your trip"
      hitSlop={spacing.sm}
      onPress={() => onPress(entry)}
      testID={`smart-add-${entry.id}`}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <Text variant="subhead" style={styles.label}>
        Smart Add
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 32,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    ...continuous,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.raised,
  },
  pressed: { backgroundColor: colors.fill },
  label: { fontWeight: '600' },
});
