/**
 * Colour tokens (docs/design.md). Dark only. Orange is the only accent: selected states, primary
 * actions, routes and the active tab. This folder is the only place raw colour values may appear
 * (lint-enforced).
 */
export const colors = {
  background: '#000000',
  surface: '#111111',
  raised: '#1A1A1A',
  /** Hairline borders between surfaces (white at 10%). */
  hairline: 'rgba(255, 255, 255, 0.1)',
  /** Selected segment and pressed fills: a lighter grey, never a colour. */
  fill: 'rgba(255, 255, 255, 0.14)',
  textPrimary: '#FFFFFF',
  textSecondary: '#A0A0A0',
  /** Text and icons on an orange fill. */
  onAccent: '#FFFFFF',
  accent: '#FF6B22',
  /** Semantic green, e.g. "On time". */
  ok: '#30D158',
  /** Background behind sheets and toasts. */
  backdrop: 'rgba(0, 0, 0, 0.6)',
} as const;

/** The one gradient design.md allows: a subtle dark scrim over photos, for legible text. */
export const photoScrim =
  'linear-gradient(180deg, rgba(0, 0, 0, 0) 35%, rgba(0, 0, 0, 0.35) 65%, rgba(0, 0, 0, 0.75) 100%)';

export type ColorToken = keyof typeof colors;

/** Foreground tones shared by Text and Icon. */
export const tones = {
  primary: colors.textPrimary,
  secondary: colors.textSecondary,
  accent: colors.accent,
  ok: colors.ok,
  onAccent: colors.onAccent,
} as const;

export type Tone = keyof typeof tones;
