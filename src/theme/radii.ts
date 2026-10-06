/**
 * Corner radii. Pair them with `continuous` for Apple's continuous (squircle) corners. Tight on list
 * cards, larger only on big photo cards (docs/design.md).
 */
export const radii = {
  sm: 8,
  /** List cards, buttons, inputs. */
  card: 12,
  /** Big photo cards. */
  photo: 16,
  pill: 999,
} as const;

/** Spread into any style with a radius: `{ borderRadius: radii.card, ...continuous }`. */
export const continuous = { borderCurve: 'continuous' } as const;

export type RadiusToken = keyof typeof radii;
