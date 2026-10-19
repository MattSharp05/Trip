import { copy, type DemoStore, upsert } from '../shared/demo';
import { withGoing } from './optOuts';
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
      setGoing(store, itemId, false);
    },
    async optIn(itemId) {
      setGoing(store, itemId, true);
    },
  };
}

function setGoing(store: DemoStore, itemId: string, going: boolean) {
  const item = store.db.items.find((i) => i.id === itemId);
  if (!item) throw new Error(`No itinerary item ${itemId}`);
  store.db = { ...store.db, items: upsert(store.db.items, withGoing(item, store.db.me, going)) };
}
