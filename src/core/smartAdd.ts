/**
 * Smart Add (ADR 0006, PRD → Plan): where a saved place or event fits best in the trip. A
 * deterministic planner, no AI. Pure TypeScript, no React Native.
 *
 * API: `planSmartAdd(input)` places one candidate and returns
 * - `{ kind: 'placed', placement, moved }`: the day and start for it, and every flexible item that
 *   had to move out of its way (only fixed-time candidates move anything);
 * - `{ kind: 'conflict', placement, conflictId }`: a fixed-time candidate overlaps the fixed item
 *   `conflictId` (a booking, a ticket); the caller decides whether to place it anyway;
 * - `{ kind: 'none', reason }`: no day has room (`no-slot`), or a fixed date is not a trip day
 *   (`outside-trip`).
 * The planner never writes anything. To place several items (Plan my bucket list, TR-32), call it
 * once per item, adding each placement (and moves) to `items` before the next call. Discover's
 * events (TR-31) are candidates with `fixedDate` and `fixedTime`.
 *
 * Flexible candidates: for each trip day, for each gap between the day's timed items, the start is
 * the later of the previous item's end plus travel, the window's start and 9:00, rounded up to the
 * quarter hour. The slot is valid when the visit ends inside the window (a window that ends before
 * it starts runs past midnight; nothing ends after 24:30) and leaves time to travel to the next
 * item. Nothing goes before the arriving flight on the first day or after the departing flight on
 * the last. Cost = added route distance (prev→x + x→next − prev→next) + `DAY_LOAD_KM` per item
 * already on the day; the lowest wins, then the emptier day, then the earlier day and time.
 *
 * Fixed-time candidates go on their date and time. A flexible item they overlap moves to its next
 * best slot: on its own day, as close to its old time as fits (inside `DEFAULT_WINDOW`), else the
 * best slot on any day.
 */

import { DEFAULT_WINDOW, durationForKind } from './bucket';
import { DEFAULT_DURATION_MIN, fromMinutes, toMinutes } from './reflow';
import { travelEstimate, type LatLng, type TravelEstimate } from './travel';

/** What the planner needs from an itinerary item. Times are wall-clock `HH:MM` (24h). */
export interface PlannerItem {
  id: string;
  day: string;
  /** Untimed items are on the day but take no slot. */
  startTime: string | null;
  durationMinutes: number | null;
  /** Bookings and tickets: never moved. */
  fixed: boolean;
  /** Null when the item has no place on the map: it adds no travel. */
  position: LatLng | null;
  /** `flight` marks arrival and departure (nothing before / after them on the trip's ends). */
  kind: string;
}

/** The place or event to fit in (a bucket item and its place). */
export interface SmartAddCandidate {
  position: LatLng | null;
  /** Visit length; without one, by place kind (`durationForKind`). */
  durationMinutes: number | null;
  kind: string | null;
  /** Opening window; without one, `DEFAULT_WINDOW`. */
  windowStart: string | null;
  windowEnd: string | null;
  /** An event: it goes on this date and time. */
  fixedDate: string | null;
  fixedTime: string | null;
}

export interface SmartAddInput {
  /** The trip's days in order (`tripDays`). */
  days: readonly string[];
  items: readonly PlannerItem[];
  candidate: SmartAddCandidate;
  /** Travel between two places; the TR-22 estimate by default. */
  travel?: (from: LatLng, to: LatLng) => TravelEstimate;
}

export interface Placement {
  day: string;
  startTime: string;
  durationMinutes: number;
  /** The item before it that day and the trip from there (the toast's "6 min walk from …"). */
  previous: { id: string; travel: TravelEstimate | null } | null;
  /** Route km the placement adds to the day. */
  addedKm: number;
}

/** A flexible item moved out of a fixed-time candidate's way. */
export interface MovedItem {
  id: string;
  day: string;
  startTime: string;
  from: { day: string; startTime: string | null };
}

export type SmartAddResult =
  | { kind: 'placed'; placement: Placement; moved: MovedItem[] }
  | { kind: 'conflict'; placement: Placement; conflictId: string }
  | { kind: 'none'; reason: 'no-slot' | 'outside-trip' };

/** Planned visits start between 9:00 and end by 24:30 (half past midnight). */
export const DAY_START_MIN = 9 * 60;
export const DAY_END_MIN = 24 * 60 + 30;
/** Each item already on a day weighs like this much extra travel: busy days fill last. */
export const DAY_LOAD_KM = 0.5;
/** Starts are rounded up to the quarter hour. */
export const STEP_MIN = 15;

const DAY_MINUTES = 24 * 60;
const EPSILON = 1e-9;

type Travel = (from: LatLng, to: LatLng) => TravelEstimate;

const durationOf = (item: PlannerItem) => item.durationMinutes ?? DEFAULT_DURATION_MIN;
const endOf = (item: PlannerItem) => toMinutes(item.startTime!) + durationOf(item);

/** The window in minutes since the day's midnight; an end before the start runs past midnight. */
export function windowMinutes(start: string | null, end: string | null) {
  const from = toMinutes(start ?? DEFAULT_WINDOW.start);
  let to = toMinutes(end ?? DEFAULT_WINDOW.end);
  if (to <= from) to += DAY_MINUTES;
  return { from: Math.max(from, DAY_START_MIN), to: Math.min(to, DAY_END_MIN) };
}

/** The day's timed items in order. */
function timeline(items: readonly PlannerItem[], day: string) {
  return items
    .filter((item) => item.day === day && item.startTime !== null)
    .sort((a, b) => a.startTime!.localeCompare(b.startTime!) || a.id.localeCompare(b.id));
}

const between = (travel: Travel, a: LatLng | null, b: LatLng | null) =>
  a && b ? travel(a, b) : null;

interface Slot extends Placement {
  cost: number;
  load: number;
  /** Minutes from the preferred start (a moved item's old time); 0 without one. */
  shift: number;
}

/** The best slot for a visit of `duration` inside `window` on `day`, or null. */
function bestOnDay(
  day: string,
  isFirst: boolean,
  isLast: boolean,
  items: readonly PlannerItem[],
  position: LatLng | null,
  duration: number,
  window: { from: number; to: number },
  travel: Travel,
  prefer?: number,
): Slot | null {
  const line = timeline(items, day);
  const load = items.filter((item) => item.day === day).length;
  const flights = line.map((item, i) => (item.kind === 'flight' ? i : -1)).filter((i) => i >= 0);
  // Gap i sits between line[i - 1] and line[i]; gaps run 0..line.length.
  const firstGap = isFirst && flights.length ? flights[0] + 1 : 0;
  const lastGap = isLast && flights.length ? flights.at(-1)! : line.length;

  let best: Slot | null = null;
  for (let gap = firstGap; gap <= lastGap; gap += 1) {
    const prev = line[gap - 1] ?? null;
    const next = line[gap] ?? null;
    const fromPrev = prev ? between(travel, prev.position, position) : null;
    const toNext = next ? between(travel, position, next.position) : null;

    const earliest = Math.max(
      window.from,
      prev ? endOf(prev) + (fromPrev?.minutes ?? 0) : window.from,
    );
    const earliestStart = Math.ceil(earliest / STEP_MIN) * STEP_MIN;
    const latestEnd = Math.min(
      window.to,
      next ? toMinutes(next.startTime!) - (toNext?.minutes ?? 0) : window.to,
    );
    // A moved item keeps as close to its old time as the gap allows; anything else goes first.
    const latestStart = Math.floor((latestEnd - duration) / STEP_MIN) * STEP_MIN;
    const start =
      prefer === undefined ? earliestStart : Math.max(earliestStart, Math.min(prefer, latestStart));
    if (start >= DAY_MINUTES || start + duration > latestEnd) continue;

    const direct = prev && next ? between(travel, prev.position, next.position) : null;
    const addedKm = Math.max(
      0,
      (fromPrev?.distanceKm ?? 0) + (toNext?.distanceKm ?? 0) - (direct?.distanceKm ?? 0),
    );
    const cost = addedKm + DAY_LOAD_KM * load;
    const shift = prefer === undefined ? 0 : Math.abs(start - prefer);
    if (!best || shift < best.shift || (shift === best.shift && cost < best.cost - EPSILON)) {
      best = {
        day,
        startTime: fromMinutes(start),
        durationMinutes: duration,
        previous: prev ? { id: prev.id, travel: fromPrev } : null,
        addedKm,
        cost,
        load,
        shift,
      };
    }
  }
  return best;
}

/** Lowest cost, then the emptier day; `slots` come earliest day first, so ties stay earliest. */
function pick(slots: (Slot | null)[]): Slot | null {
  let best: Slot | null = null;
  for (const slot of slots) {
    if (!slot) continue;
    if (
      !best ||
      slot.cost < best.cost - EPSILON ||
      (Math.abs(slot.cost - best.cost) <= EPSILON && slot.load < best.load)
    ) {
      best = slot;
    }
  }
  return best;
}

const strip = ({ cost: _cost, load: _load, shift: _shift, ...placement }: Slot): Placement =>
  placement;

function bestSlot(
  days: readonly string[],
  items: readonly PlannerItem[],
  position: LatLng | null,
  duration: number,
  window: { from: number; to: number },
  travel: Travel,
): Slot | null {
  return pick(
    days.map((day) =>
      bestOnDay(
        day,
        day === days[0],
        day === days.at(-1),
        items,
        position,
        duration,
        window,
        travel,
      ),
    ),
  );
}

/** Where `input.candidate` fits best. Same input, same answer. */
export function planSmartAdd(input: SmartAddInput): SmartAddResult {
  const { days, items, candidate } = input;
  const travel = input.travel ?? travelEstimate;
  const duration = candidate.durationMinutes ?? durationForKind(candidate.kind);

  if (candidate.fixedDate && candidate.fixedTime) {
    return placeFixed(days, items, candidate, duration, travel);
  }

  const window = windowMinutes(candidate.windowStart, candidate.windowEnd);
  const slot = bestSlot(days, items, candidate.position, duration, window, travel);
  return slot
    ? { kind: 'placed', placement: strip(slot), moved: [] }
    : { kind: 'none', reason: 'no-slot' };
}

function placeFixed(
  days: readonly string[],
  items: readonly PlannerItem[],
  candidate: SmartAddCandidate,
  duration: number,
  travel: Travel,
): SmartAddResult {
  const day = candidate.fixedDate!;
  if (!days.includes(day)) return { kind: 'none', reason: 'outside-trip' };
  const from = toMinutes(candidate.fixedTime!);
  const to = from + duration;

  const line = timeline(items, day);
  /** The placement, after the last stop that day that starts before it (once moves are done). */
  const placementAfter = (others: readonly PlannerItem[]): Placement => {
    const before =
      timeline(others, day)
        .filter((item) => toMinutes(item.startTime!) + durationOf(item) <= from)
        .at(-1) ?? null;
    const fromPrev = before ? between(travel, before.position, candidate.position) : null;
    return {
      day,
      startTime: candidate.fixedTime!,
      durationMinutes: duration,
      previous: before ? { id: before.id, travel: fromPrev } : null,
      addedKm: fromPrev?.distanceKm ?? 0,
    };
  };

  const overlapping = line.filter((item) => {
    const start = toMinutes(item.startTime!);
    return from < start + durationOf(item) && start < to;
  });
  const fixed = overlapping.find((item) => item.fixed);
  if (fixed) return { kind: 'conflict', placement: placementAfter(items), conflictId: fixed.id };

  // The event takes its slot; each overlapped flexible item then finds its next best slot.
  const event: PlannerItem = {
    id: '\u0000smart-add',
    day,
    startTime: candidate.fixedTime,
    durationMinutes: duration,
    fixed: true,
    position: candidate.position,
    kind: 'event',
  };
  const movingIds = new Set(overlapping.map((item) => item.id));
  const staying = items.filter((item) => !movingIds.has(item.id));
  let current: PlannerItem[] = [...staying, event];
  const moved: MovedItem[] = [];
  const window = windowMinutes(DEFAULT_WINDOW.start, DEFAULT_WINDOW.end);
  for (const item of overlapping) {
    const duration = durationOf(item);
    const own = item.day;
    const slot =
      bestOnDay(
        own,
        own === days[0],
        own === days.at(-1),
        current,
        item.position,
        duration,
        window,
        travel,
        toMinutes(item.startTime!),
      ) ?? bestSlot(days, current, item.position, duration, window, travel);
    if (!slot) return { kind: 'none', reason: 'no-slot' };
    moved.push({
      id: item.id,
      day: slot.day,
      startTime: slot.startTime,
      from: { day: item.day, startTime: item.startTime },
    });
    current = [...current, { ...item, day: slot.day, startTime: slot.startTime }];
  }
  current = current.filter((item) => item !== event);
  return { kind: 'placed', placement: placementAfter(current), moved };
}
