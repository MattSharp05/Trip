import type { ItineraryItem } from './types';

/** The stop with `me` in or out of it (TR-60); the others' opt-outs stay as they were. */
export function withGoing(item: ItineraryItem, me: string, going: boolean): ItineraryItem {
  const others = (item.optedOut ?? []).filter((id) => id !== me);
  return { ...item, optedOut: going ? others : [...others, me] };
}
