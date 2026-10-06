import type { SFSymbol } from 'expo-symbols';
import { Pressable, StyleSheet } from 'react-native';

import { colors, continuous, radii, spacing } from '@/theme';

import { Icon } from './Icon';
import { Text } from './Text';

export interface ButtonProps {
  label: string;
  /** `primary` is orange: one per screen, for the main action. */
  variant?: 'primary' | 'secondary';
  icon?: SFSymbol;
  onPress?: () => void;
  disabled?: boolean;
  testID?: string;
}

export function Button({
  label,
  variant = 'primary',
  icon,
  onPress,
  disabled = false,
  testID,
}: ButtonProps) {
  const primary = variant === 'primary';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.button,
        primary ? styles.primary : styles.secondary,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      {icon ? <Icon name={icon} size="sm" tone={primary ? 'onAccent' : 'primary'} /> : null}
      <Text variant="headline" tone={primary ? 'onAccent' : 'primary'}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 50,
    paddingHorizontal: spacing.xl,
    borderRadius: radii.card,
    ...continuous,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  primary: { backgroundColor: colors.accent },
  secondary: {
    backgroundColor: colors.raised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
  },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.4 },
});
