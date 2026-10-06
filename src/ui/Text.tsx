import { Text as RNText, type TextProps as RNTextProps } from 'react-native';

import { colors, typography, type TypeVariant } from '@/theme';

export type TextTone = 'primary' | 'secondary' | 'accent' | 'ok' | 'onAccent';

const toneColor: Record<TextTone, string> = {
  primary: colors.textPrimary,
  secondary: colors.textSecondary,
  accent: colors.accent,
  ok: colors.ok,
  onAccent: colors.onAccent,
};

export interface TextProps extends RNTextProps {
  variant?: TypeVariant;
  tone?: TextTone;
}

/** All app text: a type-scale variant on the system font, in a token colour. */
export function Text({ variant = 'body', tone = 'primary', style, ...rest }: TextProps) {
  return <RNText {...rest} style={[typography[variant], { color: toneColor[tone] }, style]} />;
}
