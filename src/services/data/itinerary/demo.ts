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
  };
}
