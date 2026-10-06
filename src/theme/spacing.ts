/** Spacing scale in points (4-pt grid). */
export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

/** Side margin of every screen. */
export const screenPadding = spacing.lg;

export type SpacingToken = keyof typeof spacing;
