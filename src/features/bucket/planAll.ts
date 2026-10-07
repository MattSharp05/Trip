import { dayOfMonth, timeLabel, tripDays, weekdayShort } from '@/core/dates';
import { newId } from '@/core/ids';
import { planAll } from '@/core/planAll';
import { itemTitle, kindForPlace } from '@/features/plan/edit/edits';
import type { BucketItem, ItineraryItem, TripData } from '@/services/data/types';

import { candidateFor, plannerItems, type SmartAddChange } from './smartAdd';

/** What tapping Plan my bucket list leads to: the writes, the toast, and notes for what didn't fit. */
export interface PlanAllPlan {
  /** Null when nothing fit (no writes, no Undo). */
  change: SmartAddChange | null;
  undo: SmartAddChange | null;
  message: string;
  /** Bucket item id → why it stayed in the list ("Didn't fit any day's free time"). */
  notes: Record<string, string>;
  /** The first new stop (earliest day and time), for the screen to open its day. */
  first: { itemId: string; day: string } | null;
}

export const NO_ROOM_NOTE = "Didn't fit any day's free time";
export const OUTSIDE_TRIP_NOTE = 'Not during this trip';

/** "Fri 13, Sat 14 and Sun 15" */
function daysLabel(days: string[]): string {
  const labels = days.map((day) => `${weekdayShort(day)} ${dayOfMonth(day)}`);
  return labels.length > 1 ? `${labels.slice(0, -1).join(', ')} and ${labels.at(-1)}` : labels[0];
}

/** "Overlaps UFC 310 at 7:00 PM": a stop already planned, or an event placed in this same run. */
function clashNote(data: TripData, conflictId: string): string {
  const stop = data.items.find((item) => item.id === conflictId);
  if (stop) return `Overlaps ${itemTitle(data, stop)} at ${timeLabel(stop.startTime ?? '00:00')}`;
  const event = data.bucketItems.find((b) => b.id === conflictId);
  const name = event?.title || data.places.find((p) => p.id === event?.placeId)?.name;
  return event?.fixedTime && name
    ? `Overlaps ${name} at ${timeLabel(event.fixedTime)}`
    : NO_ROOM_NOTE;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * Plan my bucket list (TR-32): places every bucket item that fits (`core/planAll`), as one change
 * with one Undo that puts the whole set back. `ids` makes the new stops' ids (tests).
 */
export function planBucketAll(data: TripData, ids: () => string = newId): PlanAllPlan {
  const byId = new Map(data.bucketItems.map((b) => [b.id, b]));
  const result = planAll({
    days: tripDays(data.trip.startDate, data.trip.endDate),
    items: plannerItems(data),
    candidates: data.bucketItems.map((b) => ({ id: b.id, candidate: candidateFor(data, b) })),
  });

  const notes: Record<string, string> = {};
  for (const skip of result.skipped) {
    notes[skip.id] =
      skip.reason === 'conflict'
        ? clashNote(data, skip.conflictId!)
        : skip.reason === 'outside-trip'
          ? OUTSIDE_TRIP_NOTE
          : NO_ROOM_NOTE;
  }

  if (result.placed.length === 0) {
    return {
      change: null,
      undo: null,
      message: "Nothing fit: your days are full or the places are closed when you're free.",
      notes,
      first: null,
    };
  }

  // Final day and time of every planner item (later events can move stops placed earlier).
  const final = new Map(result.items.map((item) => [item.id, item]));
  const added: ItineraryItem[] = result.placed.map(({ id: bucketId, placement }) => {
    const bucketItem = byId.get(bucketId) as BucketItem;
    const place = data.places.find((p) => p.id === bucketItem.placeId);
    const fixedTime = bucketItem.fixedDate !== null && bucketItem.fixedTime !== null;
    const at = final.get(bucketId)!;
    return {
      id: ids(),
      tripId: data.trip.id,
      day: at.day,
      startTime: at.startTime,
      durationMinutes: placement.durationMinutes,
      placeId: bucketItem.placeId,
      kind: fixedTime ? 'event' : kindForPlace(place?.kind ?? null),
      bookingId: null,
      fixed: fixedTime,
      ...(bucketItem.title ? { title: bucketItem.title } : {}),
    };
  });
  const movedIds = new Set(result.moved.map((m) => m.id));
  const before = data.items.filter((item) => movedIds.has(item.id));
  const after = before.map((item) => {
    const at = final.get(item.id)!;
    return { ...item, day: at.day, startTime: at.startTime };
  });
  const placedBucket = result.placed.map((p) => byId.get(p.id) as BucketItem);

  const firstAdded = [...added].sort(
    (a, b) => a.day.localeCompare(b.day) || (a.startTime ?? '').localeCompare(b.startTime ?? ''),
  )[0];
  const days = [...new Set(added.map((item) => item.day))].sort();
  const summary = [daysLabel(days)];
  if (after.length) summary.push(`moved ${plural(after.length, 'stop', 'stops')}`);
  if (result.skipped.length) summary.push(`${result.skipped.length} didn't fit`);

  return {
    change: {
      save: [...added, ...after],
      remove: [],
      saveBucket: [],
      removeBucket: placedBucket.map((b) => b.id),
    },
    undo: {
      save: before,
      remove: added.map((item) => item.id),
      saveBucket: placedBucket,
      removeBucket: [],
    },
    message: `Placed ${plural(added.length, 'item', 'items')} across your trip\n${summary.join(' · ')}`,
    notes,
    first: { itemId: firstAdded.id, day: firstAdded.day },
  };
}
