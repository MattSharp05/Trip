/**
 * Editing a day's timeline (PRD → Plan): what reordering, retiming or moving an item does to the
 * day's times. Pure TypeScript, no React Native.
 *
 * Reordering swaps time slots. The day's flexible items between the picked-up row and the row it
 * is dropped on keep the slots they had (their start times, earliest first) but take them in the
 * new order; each starts no earlier than the one before it ends, so a longer item pushes the next
 * one later. Fixed items (bookings, tickets) keep their time: dropping onto one is refused, and so
 * is any change that would overlap one.
 */

/** What re-flow needs from an itinerary item. Times are wall-clock `HH:MM` (24h). */
export interface ReflowItem {
  id: string;
  startTime: string | null;
  durationMinutes: number | null;
  fixed: boolean;
}

/** An item without a duration is planned as an hour. */
export const DEFAULT_DURATION_MIN = 60;
const DAY_MINUTES = 24 * 60;

export type ReflowResult =
  /** `times`: the new start time of every item that changed, by id. */
  | { ok: true; times: Record<string, string> }
  /** The picked-up item is fixed: it keeps its time, so it can't be reordered. */
  | { ok: false; reason: 'fixed'; id: string }
  /** It would overlap the fixed item `id`. */
  | { ok: false; reason: 'overlap'; id: string }
  /** It would start after midnight. */
  | { ok: false; reason: 'late' };

/** Minutes since midnight of an `HH:MM` time. */
export function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

/** `HH:MM` for minutes since midnight. */
export function fromMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

const durationOf = (item: ReflowItem) => item.durationMinutes ?? DEFAULT_DURATION_MIN;

/** The first fixed item (other than `id`) that `[start, start + duration)` would overlap. */
export function fixedOverlap<T extends ReflowItem>(
  items: readonly T[],
  id: string,
  start: string,
  durationMinutes: number | null,
): T | null {
  const from = toMinutes(start);
  const to = from + (durationMinutes ?? DEFAULT_DURATION_MIN);
  return (
    items.find((other) => {
      if (other.id === id || !other.fixed || !other.startTime) return false;
      const otherFrom = toMinutes(other.startTime);
      return from < otherFrom + durationOf(other) && otherFrom < to;
    }) ?? null
  );
}

/**
 * Move the item at `from` to `to` in the day's visit order (`items`, as the timeline lists them)
 * and work out the new times.
 */
export function reorder(items: readonly ReflowItem[], from: number, to: number): ReflowResult {
  const moved = items[from];
  if (moved.fixed) return { ok: false, reason: 'fixed', id: moved.id };
  if (from === to) return { ok: true, times: {} };
  const target = items[to];
  if (target.fixed) return { ok: false, reason: 'overlap', id: target.id };

  const order = [...items];
  order.splice(from, 1);
  order.splice(to, 0, moved);

  const lo = Math.min(from, to);
  const hi = Math.max(from, to);
  const flexible = (item: ReflowItem) => !item.fixed;
  // The range's flexible slots, earliest first; untimed items (listed last) have none.
  const slots = items
    .slice(lo, hi + 1)
    .filter(flexible)
    .map((item) => item.startTime)
    .filter((time): time is string => time !== null)
    .map(toMinutes)
    .sort((a, b) => a - b);
  // An untimed slot follows on from the item before it.
  const before = order
    .slice(0, lo)
    .filter((item) => item.startTime !== null)
    .at(-1);
  let cursor = before?.startTime ? toMinutes(before.startTime) + durationOf(before) : null;

  const times: Record<string, string> = {};
  const changed: ReflowItem[] = [];
  let slot = 0;
  for (let i = lo; i < order.length; i += 1) {
    const item = order[i];
    if (!flexible(item)) continue;
    let start: number | null;
    if (i <= hi) {
      const own = slots[slot] ?? null;
      slot += 1;
      start = own !== null && cursor !== null ? Math.max(own, cursor) : (own ?? cursor);
    } else if (item.startTime && cursor !== null && toMinutes(item.startTime) < cursor) {
      // After the range: only pushed later when the item before now runs into it.
      start = cursor;
    } else {
      break;
    }
    if (start === null) continue;
    if (start >= DAY_MINUTES) return { ok: false, reason: 'late' };
    const time = fromMinutes(start);
    if (time !== item.startTime) {
      times[item.id] = time;
      changed.push({ ...item, startTime: time });
    }
    cursor = start + durationOf(item);
  }

  for (const item of changed) {
    const clash = fixedOverlap(items, item.id, item.startTime!, item.durationMinutes);
    if (clash) return { ok: false, reason: 'overlap', id: clash.id };
  }
  return { ok: true, times };
}
