import { timeLabel } from '@/core/dates';
import { DEFAULT_DURATION_MIN, fixedOverlap, fromMinutes, reorder, toMinutes } from '@/core/reflow';
import type { ItemKind, ItineraryItem, Place, TripData } from '@/services/data/types';

import { dayItems } from '../itinerary';

/** One optimistic write to the itinerary: items to save (new or changed) and ids to delete. */
export interface ItineraryEdit {
  save: ItineraryItem[];
  remove: string[];
  /** A place the saved items point at that the trip doesn't have yet (a new stop). */
  place?: Place;
}

/** What an edit gesture leads to: a write, or a short message saying why not. */
export type EditPlan = { edit: ItineraryEdit } | { message: string };

/** The trip data as it looks with `edit` applied (the optimistic cache update). */
export function applyEdit(data: TripData, edit: ItineraryEdit): TripData {
  const saved = new Map(edit.save.map((item) => [item.id, item]));
  const items = data.items
    .filter((item) => !edit.remove.includes(item.id) && !saved.has(item.id))
    .concat(edit.save);
  const places =
    edit.place && !data.places.some((p) => p.id === edit.place?.id)
      ? [...data.places, edit.place]
      : data.places;
  return { ...data, items, places };
}

/** The name a row shows for an item: its own title, else its place's. */
export function itemTitle(data: TripData, item: ItineraryItem): string {
  return item.title || data.places.find((p) => p.id === item.placeId)?.name || 'Untitled stop';
}

const overlapMessage = (data: TripData, fixed: ItineraryItem) =>
  `Overlaps ${itemTitle(data, fixed)} at ${timeLabel(fixed.startTime ?? '00:00')}.`;

const bookedMessage = (data: TripData, item: ItineraryItem) =>
  `${itemTitle(data, item)} gets its time from the booking.`;

/** Drag a row from `from` to `to` on `day` (indexes in the timeline's order). */
export function planReorder(data: TripData, day: string, from: number, to: number): EditPlan {
  const items = dayItems(data.items, day);
  const result = reorder(items, from, to);
  if (!result.ok) {
    if (result.reason === 'late') return { message: 'That would run past midnight.' };
    const item = items.find((i) => i.id === result.id)!;
    return result.reason === 'fixed'
      ? { message: `${itemTitle(data, item)} has a fixed time.` }
      : { message: overlapMessage(data, item) };
  }
  const save = items
    .filter((item) => result.times[item.id] !== undefined)
    .map((item) => ({ ...item, startTime: result.times[item.id] }));
  return { edit: { save, remove: [] } };
}

/**
 * Save an item's new values (time picker, detail sheet, another day), refusing a time that would
 * overlap a fixed item that day, or a change to a booking's time or day.
 */
export function planUpdate(data: TripData, next: ItineraryItem): EditPlan {
  const current = data.items.find((item) => item.id === next.id);
  if (!current) return { message: 'That stop is no longer on your trip.' };
  const timing =
    current.startTime !== next.startTime ||
    current.durationMinutes !== next.durationMinutes ||
    current.day !== next.day;
  if (timing && current.bookingId) return { message: bookedMessage(data, current) };
  if (timing && next.startTime) {
    const clash = fixedOverlap(
      dayItems(data.items, next.day),
      next.id,
      next.startTime,
      next.durationMinutes,
    );
    if (clash) return { message: overlapMessage(data, clash) };
  }
  return { edit: { save: [next], remove: [] } };
}

/** Where a new stop goes by default: after the day's last timed stop, else 10:00 AM. */
export function suggestedStart(data: TripData, day: string): string {
  const last = dayItems(data.items, day)
    .filter((item) => item.startTime !== null)
    .at(-1);
  if (!last?.startTime) return '10:00';
  const end = toMinutes(last.startTime) + (last.durationMinutes ?? DEFAULT_DURATION_MIN);
  // The next quarter hour, and never later than 11:00 PM.
  return fromMinutes(Math.min(Math.ceil(end / 15) * 15, 23 * 60));
}

/** The itinerary kind for a searched place's kind. */
export function kindForPlace(kind: string | null): ItemKind {
  if (kind === 'food') return 'food';
  if (kind === 'hotel') return 'hotel';
  return 'activity';
}

/** Add a new stop, refusing a time that would overlap a fixed item that day. */
export function planAdd(data: TripData, item: ItineraryItem): EditPlan {
  if (item.startTime) {
    const clash = fixedOverlap(
      dayItems(data.items, item.day),
      item.id,
      item.startTime,
      item.durationMinutes,
    );
    if (clash) return { message: overlapMessage(data, clash) };
  }
  return { edit: { save: [item], remove: [] } };
}

/** Why an item's time can't be changed here, or null when it can. */
export function lockedReason(data: TripData, item: ItineraryItem): string | null {
  return item.bookingId ? bookedMessage(data, item) : null;
}
