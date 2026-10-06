import { Pressable, StyleSheet } from 'react-native';

import { colors, radii, spacing } from '@/theme';

import { Text } from './Text';

export interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  testID?: string;
}

/** A filter pill. Orange when selected, grey otherwise. */
export function Chip({ label, selected = false, onPress, testID }: ChipProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.chip,
        selected ? styles.selected : styles.idle,
        pressed && !selected && styles.pressed,
      ]}
    >
      <Text variant="subhead" tone={selected ? 'onAccent' : 'primary'} style={styles.label}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    height: 32,
    paddingHorizontal: spacing.md + spacing.xxs,
    borderRadius: radii.pill,
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  idle: { backgroundColor: colors.raised, borderColor: colors.hairline },
  selected: { backgroundColor: colors.accent, borderColor: colors.accent },
  pressed: { backgroundColor: colors.fill },
  label: { fontWeight: '500' },
});
