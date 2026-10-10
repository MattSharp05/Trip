import { copy, type DemoStore, upsert } from '../shared/demo';
import type { Place, PlacesSource } from './types';

/** The places slice of the demo source. */
export function demoPlaces(store: DemoStore): PlacesSource {
  return {
    async savePlace(input) {
      const { db } = store;
      const place: Place = {
        ...copy(input),
        id: input.id ?? `place-${Date.now().toString(36)}-${db.places.length}`,
      };
      store.db = { ...db, places: upsert(db.places, place) };
      return copy(place);
    },
    async deletePlace(id) {
      const { db } = store;
      // As in Postgres: rows that pointed at it keep going without a place.
      store.db = {
        ...db,
        places: db.places.filter((p) => p.id !== id),
        items: db.items.map((i) => (i.placeId === id ? { ...i, placeId: null } : i)),
      };
    },
  };
}
