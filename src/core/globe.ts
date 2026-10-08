/**
 * The camera height that shows the whole Earth on Apple's globe in a view of a given size. TR-16
 * tuned 24,000 km for its 200 pt band; the Earth's apparent size follows the view's height, so a
 * taller view needs a higher camera for the globe to still fit its width (TR-46 QA round 2).
 */

const EARTH_RADIUS_KM = 6371;
/** The TR-16 band (200 pt high, wider than tall): the Earth just fits its height at 24,000 km. */
const BAND_ALTITUDE_KM = 24_000;
/** The Earth's angular size seen from the band's camera. */
const BAND_ANGLE = 2 * Math.asin(EARTH_RADIUS_KM / (EARTH_RADIUS_KM + BAND_ALTITUDE_KM));

/** Metres above the ground so the whole Earth fits a `width` × `height` pt view. */
export function globeAltitude({ width, height }: { width: number; height: number }): number {
  if (width <= 0 || height <= 0) return BAND_ALTITUDE_KM * 1000;
  // At the band's camera the Earth fills the view's height, whatever that height is; shrink its
  // angular size so it fits the shorter side instead.
  const angle = BAND_ANGLE * (Math.min(width, height) / height);
  const km = EARTH_RADIUS_KM / Math.sin(angle / 2) - EARTH_RADIUS_KM;
  return Math.round(km * 1000);
}
