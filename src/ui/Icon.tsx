import { SymbolView, type SFSymbol, type SymbolWeight } from 'expo-symbols';
import type { StyleProp, ViewStyle } from 'react-native';

import { colors, tones, type Tone } from '@/theme';

const sizes = { sm: 15, md: 20, lg: 24, xl: 28 } as const;

export type IconSize = keyof typeof sizes;
export type IconTone = Tone;

export interface IconProps {
  name: SFSymbol;
  size?: IconSize;
  /** Ignored when `selected`: selected icons are always orange. */
  tone?: IconTone;
  selected?: boolean;
  weight?: SymbolWeight;
  /** Spoken label. Without one the icon is decorative and hidden from VoiceOver. */
  label?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** The only way to draw an icon: an outlined SF Symbol in a token colour. */
export function Icon({
  name,
  size = 'md',
  tone = 'primary',
  selected = false,
  weight = 'regular',
  label,
  style,
  testID,
}: IconProps) {
  return (
    <SymbolView
      name={name}
      size={sizes[size]}
      weight={weight}
      tintColor={selected ? colors.accent : tones[tone]}
      accessible={!!label}
      accessibilityLabel={label}
      accessibilityElementsHidden={!label}
      importantForAccessibility={label ? 'yes' : 'no-hide-descendants'}
      style={style}
      testID={testID}
    />
  );
}

export const iconSizes = sizes;
