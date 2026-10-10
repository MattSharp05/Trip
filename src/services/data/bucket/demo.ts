import { copy, type DemoStore, upsert } from '../shared/demo';
import type { BucketSource } from './types';

/** The Bucket List slice of the demo source. */
export function demoBucket(store: DemoStore): BucketSource {
  return {
    async saveBucketItem(item) {
      store.db = { ...store.db, bucketItems: upsert(store.db.bucketItems, copy(item)) };
      return copy(item);
    },
    async deleteBucketItem(id) {
      store.db = { ...store.db, bucketItems: store.db.bucketItems.filter((b) => b.id !== id) };
    },
  };
}
