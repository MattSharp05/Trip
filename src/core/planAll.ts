/**
 * Plan my bucket list (TR-32, ADR 0006): places a whole set of candidates at once, greedily, most
 * constrained first. Pure TypeScript, no React Native.
 *
 * Order (`byConstraint`): fixed-time events first (by date and time), then the narrowest window,
 * then the longest visit, then id. Each candidate then goes through Smart Add (`planSmartAdd`)
 * against the plan as it stands after the ones before it, so nothing placed here overlaps.
 *
 * A candidate that clashes with a fixed item (a booking, a ticket) is not placed: one tap must never
 * double-book. It is skipped with reason `conflict`, like a candidate with no room (`no-slot`) or
 * an event outside the trip (`outside-trip`).
 */

import { durationForKind } from './bucket';
import {
  planSmartAdd,
  windowMinutes,
  type MovedItem,
  type Placement,
  type PlannerItem,
  type SmartAddCandidate,
} from './smartAdd';
import type { LatLng, TravelEstimate } from './travel';

export interface PlanAllCandidate {
  /** The bucket item's id; placed stops get `id` back with their placement. */
  id: string;
  candidate: SmartAddCandidate;
}

export interface PlanAllInput {
  days: readonly string[];
  items: readonly PlannerItem[];
  candidates: readonly PlanAllCandidate[];
  travel?: (from: LatLng, to: LatLng) => TravelEstimate;
}

export interface PlanAllPlaced {
  id: string;
  placement: Placement;
}

export interface PlanAllSkipped {
  id: string;
  reason: 'no-slot' | 'outside-trip' | 'conflict';
  /** With `conflict`: the fixed item it overlaps. */
  conflictId?: string;
}

export interface PlanAllResult {
  /** In placing order. A placed stop's final day and time can differ when a later event moved it. */
  placed: PlanAllPlaced[];
  skipped: PlanAllSkipped[];
  /** Every move, in order; an item can move more than once (its last entry wins). */
  moved: MovedItem[];
  /** The itinerary afterwards, placed stops included (their planner ids are the candidate ids). */
  items: PlannerItem[];
}

const isFixed = (c: SmartAddCandidate) => c.fixedDate !== null && c.fixedTime !== null;

/** Minutes the candidate can be placed in on a day (fixed events have none to choose from). */
const windowWidth = (c: SmartAddCandidate) => {
  const { from, to } = windowMinutes(c.windowStart, c.windowEnd);
  return to - from;
};

const durationOf = (c: SmartAddCandidate) => c.durationMinutes ?? durationForKind(c.kind);

/** Most constrained first: events by date and time, then narrowest window, then longest visit. */
export function byConstraint(a: PlanAllCandidate, b: PlanAllCandidate): number {
  const fixedA = isFixed(a.candidate);
  const fixedB = isFixed(b.candidate);
  if (fixedA !== fixedB) return fixedA ? -1 : 1;
  if (fixedA && fixedB) {
    const whenA = `${a.candidate.fixedDate} ${a.candidate.fixedTime}`;
    const whenB = `${b.candidate.fixedDate} ${b.candidate.fixedTime}`;
    if (whenA !== whenB) return whenA.localeCompare(whenB);
  } else {
    const width = windowWidth(a.candidate) - windowWidth(b.candidate);
    if (width !== 0) return width;
  }
  const length = durationOf(b.candidate) - durationOf(a.candidate);
  if (length !== 0) return length;
  return a.id.localeCompare(b.id);
}

/** Places every candidate that fits. Same input, same answer. */
export function planAll(input: PlanAllInput): PlanAllResult {
  const { days, travel } = input;
  let items: PlannerItem[] = [...input.items];
  const placed: PlanAllPlaced[] = [];
  const skipped: PlanAllSkipped[] = [];
  const moved: MovedItem[] = [];

  for (const { id, candidate } of [...input.candidates].sort(byConstraint)) {
    const result = planSmartAdd({ days, items, candidate, travel });
    if (result.kind === 'none') {
      skipped.push({ id, reason: result.reason });
      continue;
    }
    if (result.kind === 'conflict') {
      skipped.push({ id, reason: 'conflict', conflictId: result.conflictId });
      continue;
    }
    const { placement } = result;
    const movedTo = new Map(result.moved.map((m) => [m.id, m]));
    items = items.map((item) => {
      const m = movedTo.get(item.id);
      return m ? { ...item, day: m.day, startTime: m.startTime } : item;
    });
    items.push({
      id,
      day: placement.day,
      startTime: placement.startTime,
      durationMinutes: placement.durationMinutes,
      fixed: isFixed(candidate),
      position: candidate.position,
      kind: isFixed(candidate) ? 'event' : (candidate.kind ?? 'place'),
    });
    moved.push(...result.moved);
    placed.push({ id, placement });
  }

  return { placed, skipped, moved, items };
}
