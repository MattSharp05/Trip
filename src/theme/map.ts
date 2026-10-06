import { colors } from './colors';

/**
 * Map palette for the MapLibre dark style and map overlays (TR-5 spike). Near-black land, quiet
 * grey roads, a dark blue-grey for water, white labels. Orange stays reserved for the route and the
 * selected pin (docs/design.md).
 */
export const mapColors = {
  land: '#111214',
  landUrban: '#15161A',
  park: '#121A15',
  water: '#0A1620',
  building: '#1C1E22',
  buildingTop: '#24272C',
  roadMinor: '#24262B',
  roadMajor: '#34373D',
  roadHighway: '#44474E',
  boundary: '#3A3D44',
  label: colors.textPrimary,
  labelMuted: colors.textSecondary,
  labelHalo: colors.background,
  /** Space behind the globe and the thin atmosphere at its rim. */
  space: colors.background,
  atmosphere: '#1B2836',
  route: colors.accent,
  pinRing: colors.textPrimary,
  pinRingSelected: colors.accent,
  /** Dark fill behind a pin photo while it loads. */
  pinFallback: colors.raised,
} as const;
