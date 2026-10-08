/**
 * Where a dragged row lands. `offsets[i]` is where row i starts in the list and `offsets[n]` where
 * the list ends (rows differ in height: a travel leg sits under some). The row picked up at `from`
 * and moved by `dy` lands on the row its middle is over. Runs on the UI thread too (a worklet).
 */
export function dropIndex(offsets: readonly number[], from: number, dy: number): number {
  'worklet';
  const count = offsets.length - 1;
  const middle = (offsets[from] + offsets[from + 1]) / 2 + dy;
  for (let i = 0; i < count; i += 1) {
    if (middle < offsets[i + 1]) return i;
  }
  return count - 1;
}

/**
 * How far row `index` slides while row `from` is dragged over `to`: rows in between make room by
 * the dragged row's height.
 */
export function dragShift(offsets: readonly number[], from: number, to: number, index: number) {
  'worklet';
  const height = offsets[from + 1] - offsets[from];
  if (from < to && index > from && index <= to) return -height;
  if (to < from && index >= to && index < from) return height;
  return 0;
}

/** How far a finger may wander while holding a row before the hold gives way to scroll or swipe. */
export const HOLD_SLOP = 10;

/**
 * What the row's drag does as the finger moves (TR-24 QA round 3). Before the hold has lifted the
 * row, a move past the slop means the finger is scrolling or swiping, so the drag gives up; once
 * the row is lifted, the first move starts the drag.
 */
export function holdMove(lifted: boolean, dx: number, dy: number): 'drag' | 'give-up' | 'wait' {
  'worklet';
  if (lifted) return 'drag';
  return dx * dx + dy * dy > HOLD_SLOP * HOLD_SLOP ? 'give-up' : 'wait';
}
