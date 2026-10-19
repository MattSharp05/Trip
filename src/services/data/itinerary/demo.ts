import { copy, type DemoStore, upsert } from '../shared/demo';
import type { ItinerarySource } from './types';

/** The itinerary slice of the demo source. */
export function demoItinerary(store: DemoStore): ItinerarySource {
  return {
    async saveItineraryItem(item) {
      store.db = { ...store.db, items: upsert(store.db.items, copy(item)) };
      return copy(item);
    },
    async deleteItineraryItem(id) {
      store.db = { ...store.db, items: store.db.items.filter((i) => i.id !== id) };
    },
    async optOut(itemId) {
      setOptedOut(store, itemId, (out) =>
        out.includes(store.db.me) ? out : [...out, store.db.me],
      );
    },
    async optIn(itemId) {
      setOptedOut(store, itemId, (out) => out.filter((id) => id !== store.db.me));
    },
  };
}

function setOptedOut(store: DemoStore, itemId: string, change: (out: string[]) => string[]) {
  const item = store.db.items.find((i) => i.id === itemId);
  if (!item) throw new Error(`No itinerary item ${itemId}`);
  const optedOut = change(item.optedOut ?? []);
  store.db = { ...store.db, items: upsert(store.db.items, { ...item, optedOut }) };
}
