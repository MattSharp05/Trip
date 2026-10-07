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
  /** A Bucket List place (not on a day yet): an orange ring around a dark centre. */
  pinOutlineFill: colors.background,
  pinOutlineRing: colors.accent,
  /** Other days' places. */
  pinDot: colors.textSecondary,
  pinDotRing: colors.background,
  /** Round map buttons (3D, fit the day). */
  control: colors.raised,
  controlBorder: colors.hairline,
  /** Behind the Trips globe while it loads, and the space around it. */
  globeSpace: colors.background,
  /** Trips globe: city labels sit on a dark pill so they read over satellite imagery. */
  globeLabelFill: colors.backdrop,
} as const;
