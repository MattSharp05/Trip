import { dayOfMonth, timeLabel, weekdayShort, tripDays } from '@/core/dates';
import { newId } from '@/core/ids';
import { planSmartAdd, type PlannerItem, type SmartAddResult } from '@/core/smartAdd';
import { travelLabel, type LatLng } from '@/core/travel';
import { itemTitle, kindForPlace } from '@/features/plan/edit/edits';
import type { BucketItem, ItineraryItem, Place, TripData } from '@/services/data/types';

/**
 * One Smart Add, as writes: the new stop, the stops it moved, and the bucket item it came from.
 * Undo writes it backwards (`undoChange`).
 */
export interface SmartAddChange {
  /** Itinerary items to save (new or changed) and ids to delete. */
  save: ItineraryItem[];
  remove: string[];
  /** The bucket item to save again (Undo) or the id to delete (Smart Add). */
  saveBucket: BucketItem[];
  removeBucket: string[];
}

/** What tapping Smart Add leads to: the writes and the toast, or just a message why not. */
export type SmartAddPlan =
  | { change: SmartAddChange; undo: SmartAddChange; message: string; itemId: string; day: string }
  | { message: string };

export const NO_SLOT_MESSAGE = "Doesn't fit any day's free time. Drag it into a day instead.";

const position = (place: Place | undefined): LatLng | null =>
  place && place.lat !== null && place.lng !== null ? { lat: place.lat, lng: place.lng } : null;

/** The trip's itinerary as the planner sees it. */
export function plannerItems(data: Pick<TripData, 'items' | 'places'>): PlannerItem[] {
  const placeById = new Map(data.places.map((p) => [p.id, p]));
  return data.items.map((item) => ({
    id: item.id,
    day: item.day,
    startTime: item.startTime,
    durationMinutes: item.durationMinutes,
    fixed: item.fixed,
    position: position(item.placeId ? placeById.get(item.placeId) : undefined),
    kind: item.kind,
  }));
}

/** Run the planner for one bucket item of the trip. */
export function smartAddResult(data: TripData, bucketItem: BucketItem): SmartAddResult {
  const place = data.places.find((p) => p.id === bucketItem.placeId);
  return planSmartAdd({
    days: tripDays(data.trip.startDate, data.trip.endDate),
    items: plannerItems(data),
    candidate: {
      position: position(place),
      durationMinutes: bucketItem.durationMinutes,
      kind: place?.kind ?? null,
      windowStart: bucketItem.windowStart,
      windowEnd: bucketItem.windowEnd,
      fixedDate: bucketItem.fixedDate,
      fixedTime: bucketItem.fixedTime,
    },
  });
}

/** "Fri 13, 5:15 PM" */
const whenLabel = (day: string, time: string) =>
  `${weekdayShort(day)} ${dayOfMonth(day)}, ${timeLabel(time)}`;

/**
 * Smart Add one bucket item: where it goes, the writes, the Undo writes and the toast
 * ("Added to Fri 13, 5:15 PM · 6 min walk from Sphere").
 */
export function planBucketSmartAdd(
  data: TripData,
  bucketItem: BucketItem,
  id: string = newId(),
): SmartAddPlan {
  const result = smartAddResult(data, bucketItem);
  if (result.kind === 'none') {
    return {
      message:
        result.reason === 'outside-trip' ? "That event isn't during this trip." : NO_SLOT_MESSAGE,
    };
  }
  if (result.kind === 'conflict') {
    const clash = data.items.find((item) => item.id === result.conflictId)!;
    return {
      message: `Overlaps ${itemTitle(data, clash)} at ${timeLabel(clash.startTime ?? '00:00')}.`,
    };
  }

  const { placement, moved } = result;
  const place = data.places.find((p) => p.id === bucketItem.placeId);
  const fixedTime = bucketItem.fixedDate !== null && bucketItem.fixedTime !== null;
  const added: ItineraryItem = {
    id,
    tripId: data.trip.id,
    day: placement.day,
    startTime: placement.startTime,
    durationMinutes: placement.durationMinutes,
    placeId: bucketItem.placeId,
    kind: fixedTime ? 'event' : kindForPlace(place?.kind ?? null),
    bookingId: null,
    fixed: fixedTime,
    ...(bucketItem.title ? { title: bucketItem.title } : {}),
  };
  const before = moved.map((m) => data.items.find((item) => item.id === m.id)!);
  const after = moved.map((m, i) => ({ ...before[i], day: m.day, startTime: m.startTime }));

  const parts = [`Added to ${whenLabel(placement.day, placement.startTime)}`];
  const previous = placement.previous
    ? data.items.find((item) => item.id === placement.previous!.id)
    : undefined;
  if (previous && placement.previous?.travel) {
    parts.push(`${travelLabel(placement.previous.travel)} from ${itemTitle(data, previous)}`);
  }
  if (after.length === 1) {
    const [m] = after;
    parts.push(`moved ${itemTitle(data, m)} to ${whenLabel(m.day, m.startTime!)}`);
  } else if (after.length > 1) {
    parts.push(`moved ${after.length} stops`);
  }

  return {
    change: { save: [added, ...after], remove: [], saveBucket: [], removeBucket: [bucketItem.id] },
    undo: { save: before, remove: [id], saveBucket: [bucketItem], removeBucket: [] },
    message: parts.join(' · '),
    itemId: id,
    day: placement.day,
  };
}

/** The trip data as it looks with `change` applied (the optimistic cache update). */
export function applyChange(data: TripData, change: SmartAddChange): TripData {
  const saved = new Set(change.save.map((item) => item.id));
  const savedBucket = new Set(change.saveBucket.map((item) => item.id));
  return {
    ...data,
    items: data.items
      .filter((item) => !saved.has(item.id) && !change.remove.includes(item.id))
      .concat(change.save),
    bucketItems: data.bucketItems
      .filter((item) => !savedBucket.has(item.id) && !change.removeBucket.includes(item.id))
      .concat(change.saveBucket),
  };
}
