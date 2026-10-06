import { Text as RNText, type TextProps as RNTextProps } from 'react-native';

import { tones, typography, type Tone, type TypeVariant } from '@/theme';

export type TextTone = Tone;

export interface TextProps extends RNTextProps {
  variant?: TypeVariant;
  tone?: TextTone;
}

/** All app text: a type-scale variant on the system font, in a token colour. */
export function Text({ variant = 'body', tone = 'primary', style, ...rest }: TextProps) {
  return <RNText {...rest} style={[typography[variant], { color: tones[tone] }, style]} />;
}
