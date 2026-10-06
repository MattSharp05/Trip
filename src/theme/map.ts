import { colors } from './colors';

/**
 * Colours drawn on top of Apple Maps (ADR 0002: the base map is Apple's own dark appearance and
 * can't be restyled). Orange stays reserved for the route and the selected pin (docs/design.md).
 */
export const mapColors = {
  route: colors.accent,
  pinRing: colors.textPrimary,
  pinRingSelected: colors.accent,
  /** Dark fill behind a pin photo while it loads. */
  pinFallback: colors.raised,
  /** A place with no photo: its kind's symbol on orange. */
  pinSymbolFill: colors.accent,
  /** Other days' places. */
  pinDot: colors.textSecondary,
  pinDotRing: colors.background,
  /** Round map buttons (3D, fit the day). */
  control: colors.raised,
  controlBorder: colors.hairline,
} as const;
