/** Hold a row this long, without moving, before it lifts and follows the finger (TR-24). */
export const LONG_PRESS_MS = 350;

/** How far a finger may wander while holding a row before the hold gives way to scroll or swipe. */
export const HOLD_SLOP = 10;

/**
 * What a drop did (TR-24 QA round 4): the row was let go where it was (`stay`), the day was
 * reordered (`saved`), or the re-flow refused it (`refused`: the row goes back, with a warning).
 */
export type DropResult = 'stay' | 'saved' | 'refused';

/** Drop the row picked up at `from` at `to`, through the editor's `onReorder`. */
export function drop(
  from: number,
  to: number,
  onReorder: (from: number, to: number) => boolean,
): DropResult {
  if (from === to) return 'stay';
  return onReorder(from, to) ? 'saved' : 'refused';
}
