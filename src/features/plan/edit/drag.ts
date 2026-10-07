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
