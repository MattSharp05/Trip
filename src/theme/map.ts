import { colors } from './colors';

/** `#RRGGBB` at an opacity, so a lighter line is still the same colour (docs/design.md). */
const withOpacity = (hex: string, opacity: number) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

/**
 * Colours drawn on top of Apple Maps (ADR 0002: the base map is Apple's own dark appearance and
 * can't be restyled). Orange stays reserved for the route and the selected pin (docs/design.md).
 */
export const mapColors = {
  route: colors.accent,
  /** The flight globe's other travellers' arcs (TR-63): the route's orange, lighter. */
  routeOther: withOpacity(colors.accent, 0.6),
  /** Arcs dimmed while another traveller's is highlighted. */
  routeDim: withOpacity(colors.accent, 0.25),
  pinRing: colors.textPrimary,
  pinRingSelected: colors.accent,
  /** Dark fill behind a pin photo while it loads. */
  pinFallback: colors.raised,
  /** A place with no photo: its kind's symbol on orange. */
  pinSymbolFill: colors.accent,
  /** A Bucket List place (not on a day yet): an orange ring around a dark centre. */
  pinOutlineFill: colors.background,
  pinOutlineRing: colors.accent,
  /** A day stop's number badge (TR-47): dark with a white ring; orange on the selected pin. */
  pinBadgeFill: colors.background,
  pinBadgeFillSelected: colors.accent,
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
