import { copy, type DemoStore, upsert } from '../shared/demo';
import type { BucketItem, BucketSource } from './types';

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
    async likeBucketItem({ id }) {
      setLikes(id, (likedBy) => [...new Set([...likedBy, store.db.me])].sort());
    },
    async unlikeBucketItem(id) {
      setLikes(id, (likedBy) => likedBy.filter((u) => u !== store.db.me));
    },
  };

  function setLikes(id: string, change: (likedBy: string[]) => string[]) {
    const item = store.db.bucketItems.find((b) => b.id === id);
    if (!item) throw new Error(`No bucket item ${id}`);
    const next: BucketItem = { ...item, likedBy: change(item.likedBy ?? []) };
    if (!next.likedBy?.length) delete next.likedBy;
    store.db = { ...store.db, bucketItems: upsert(store.db.bucketItems, next) };
  }
}
