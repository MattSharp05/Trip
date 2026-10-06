/**
 * Type scale on the system font (SF Pro). No fontFamily is set anywhere, so iOS uses SF Pro and its
 * optical sizes.
 */
export const typography = {
  largeTitle: { fontSize: 32, lineHeight: 38, fontWeight: '700' },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '600' },
  headline: { fontSize: 17, lineHeight: 22, fontWeight: '600' },
  body: { fontSize: 15, lineHeight: 20, fontWeight: '400' },
  subhead: { fontSize: 13, lineHeight: 18, fontWeight: '400' },
  caption: { fontSize: 12.5, lineHeight: 16, fontWeight: '400' },
} as const;

export type TypeVariant = keyof typeof typography;
