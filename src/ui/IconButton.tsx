import type { SFSymbol } from 'expo-symbols';
import { Pressable, StyleSheet } from 'react-native';

import { colors, radii } from '@/theme';

import { Icon, type IconSize } from './Icon';

const diameters = { sm: 28, md: 36, lg: 44 } as const;
const glyph: Record<keyof typeof diameters, IconSize> = { sm: 'sm', md: 'md', lg: 'lg' };

export interface IconButtonProps {
  icon: SFSymbol;
  /** Spoken label (required: an icon alone says nothing to VoiceOver). */
  label: string;
  /** `filled` is the orange add button; `tinted` a grey circle; `plain` the bare glyph. */
  variant?: 'filled' | 'tinted' | 'plain';
  size?: keyof typeof diameters;
  selected?: boolean;
  onPress?: () => void;
  testID?: string;
}

export function IconButton({
  icon,
  label,
  variant = 'tinted',
  size = 'md',
  selected = false,
  onPress,
  testID,
}: IconButtonProps) {
  const diameter = diameters[size];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      hitSlop={Math.max(0, (44 - diameter) / 2)}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.base,
        { width: diameter, height: diameter },
        variant === 'filled' && styles.filled,
        variant === 'tinted' && styles.tinted,
        pressed && styles.pressed,
      ]}
    >
      <Icon
        name={icon}
        size={glyph[size]}
        tone={variant === 'filled' ? 'onAccent' : 'primary'}
        selected={selected && variant !== 'filled'}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center' },
  filled: { backgroundColor: colors.accent },
  tinted: {
    backgroundColor: colors.fill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
  },
  pressed: { opacity: 0.6 },
});
