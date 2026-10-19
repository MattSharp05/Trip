import { likeCount, sortBucket } from '@/core/bucket';
import { dayOfMonth, timeLabel, tripDays, weekdayShort } from '@/core/dates';
import { newId } from '@/core/ids';
import { nameList } from '@/core/members';
import { suggestTimes, type Suggestion } from '@/core/smartAdd';
import type { BucketItem, TripData } from '@/services/data/types';

import { clashNote, NO_ROOM_NOTE, OUTSIDE_TRIP_NOTE } from './planAll';
import { candidateFor, plannerItems, stopFor, type SmartAddChange } from './smartAdd';

/** One row of the Suggest times sheet (TR-64): a liked item and where it fits, or why not. */
export interface SuggestionRow {
  bucketId: string;
  title: string;
  /** "Fri 13, 5:15 PM · 2 likes", or the reason it doesn't fit. */
  subtitle: string;
  likes: number;
  /** Null when it doesn't fit anywhere free. */
  suggestion: Suggestion | null;
}

/** What accepting suggestions leads to: the writes, the Undo writes and the toast. */
export interface SuggestionPlan {
  change: SmartAddChange;
  undo: SmartAddChange;
  message: string;
  /** The earliest new stop, for the screen to open its day. */
  first: { itemId: string; day: string };
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** "Fri 13, 5:15 PM" */
const whenLabel = (day: string, time: string) =>
  `${weekdayShort(day)} ${dayOfMonth(day)}, ${timeLabel(time)}`;

const titleOf = (data: TripData, bucketItem: BucketItem) =>
  bucketItem.title || data.places.find((p) => p.id === bucketItem.placeId)?.name || 'Saved place';

/** The button shows when at least one Bucket List item (none of them are planned yet) has a like. */
export const hasLikedItems = (data: Pick<TripData, 'bucketItems'>) =>
  data.bucketItems.some((b) => likeCount(b) > 0);

/**
 * Suggested times for the trip's liked Bucket List items, most likes first (ties as Popular sorts
 * them: newest first). Nothing is saved. `skip` leaves items out (the sheet's Skip), so the rest are
 * planned without them.
 */
export function bucketSuggestions(
  data: TripData,
  skip: ReadonlySet<string> = new Set(),
): SuggestionRow[] {
  const liked = sortBucket(data.bucketItems, 'popular').filter(
    (b) => likeCount(b) > 0 && !skip.has(b.id),
  );
  const { suggestions, skipped } = suggestTimes({
    days: tripDays(data.trip.startDate, data.trip.endDate),
    items: plannerItems(data),
    candidates: liked.map((b) => ({
      id: b.id,
      candidate: candidateFor(data, b),
      likes: likeCount(b),
    })),
  });
  const byId = new Map(liked.map((b) => [b.id, b]));
  const likes = (b: BucketItem) => plural(likeCount(b), 'like', 'likes');
  const placed: SuggestionRow[] = suggestions.map((suggestion) => {
    const b = byId.get(suggestion.id)!;
    const { day, startTime } = suggestion.placement;
    return {
      bucketId: b.id,
      title: titleOf(data, b),
      subtitle: `${whenLabel(day, startTime)} · ${likes(b)}`,
      likes: likeCount(b),
      suggestion,
    };
  });
  const left: SuggestionRow[] = skipped.map((skip) => {
    const b = byId.get(skip.id)!;
    const note =
      skip.reason === 'conflict'
        ? clashNote(data, skip.conflictId!)
        : skip.reason === 'outside-trip'
          ? OUTSIDE_TRIP_NOTE
          : NO_ROOM_NOTE;
    return {
      bucketId: b.id,
      title: titleOf(data, b),
      subtitle: note,
      likes: likeCount(b),
      suggestion: null,
    };
  });
  // Stable: the suggestions keep their order, and each item that doesn't fit sits by its likes.
  return [...placed, ...left].sort((a, b) => b.likes - a.likes);
}

/**
 * Accepting suggestions (one, or Accept all): each liked item becomes a stop at its suggested time,
 * as one change with one Undo, like Smart Add. Suggestions never overlap or move a stop
 * (`suggestTimes`), so any of them can be accepted on their own. `ids` makes the new stops' ids.
 */
export function planSuggestions(
  data: TripData,
  accepted: readonly Suggestion[],
  ids: () => string = newId,
): SuggestionPlan | null {
  const byId = new Map(data.bucketItems.map((b) => [b.id, b]));
  const pairs = accepted.flatMap((s) => {
    const b = byId.get(s.id);
    return b ? [{ bucketItem: b, stop: stopFor(data, b, ids(), s.placement) }] : [];
  });
  if (pairs.length === 0) return null;
  const added = pairs.map((p) => p.stop);
  const first = [...added].sort(
    (a, b) => a.day.localeCompare(b.day) || (a.startTime ?? '').localeCompare(b.startTime ?? ''),
  )[0];
  const days = [...new Set(added.map((item) => item.day))]
    .sort()
    .map((day) => `${weekdayShort(day)} ${dayOfMonth(day)}`);
  const message =
    pairs.length === 1
      ? `Added ${titleOf(data, pairs[0].bucketItem)} to ${whenLabel(first.day, first.startTime!)}`
      : `Added ${plural(pairs.length, 'liked item', 'liked items')}\n${nameList(days)}`;
  return {
    change: {
      save: added,
      remove: [],
      saveBucket: [],
      removeBucket: pairs.map((p) => p.bucketItem.id),
    },
    undo: {
      save: [],
      remove: added.map((item) => item.id),
      saveBucket: pairs.map((p) => p.bucketItem),
      removeBucket: [],
    },
    message,
    first: { itemId: first.id, day: first.day },
  };
}
