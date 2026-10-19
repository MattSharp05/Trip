import { useMutation } from '@tanstack/react-query';
import { useRef } from 'react';

import { withLike } from '@/core/bucket';

import { useDataSource } from '../active';
import type { DataSource } from '../source';
import { dataKeys, queryClient, useWrite } from '../shared/query';
import type { TripData } from '../types';
import type { BucketItem } from './types';

export const useSaveBucketItem = () => useWrite((s, item: BucketItem) => s.saveBucketItem(item));
export const useDeleteBucketItem = () => useWrite((s, id: string) => s.deleteBucketItem(id));

/** A like or unlike of one item, as `me` (TR-59). */
export interface BucketLikeChange {
  item: Pick<BucketItem, 'id' | 'tripId'>;
  me: string;
  liked: boolean;
}

const LIKE_KEY = ['bucket-like'] as const;

/** Applies a like to the cached trip, so the heart and count change at once. */
function setCachedLike(source: DataSource, { item, me, liked }: BucketLikeChange) {
  const key = dataKeys.trip(source, item.tripId);
  const data = queryClient.getQueryData<TripData | null>(key);
  if (data) {
    queryClient.setQueryData<TripData>(key, {
      ...data,
      bucketItems: withLike(data.bucketItems, item.id, me, liked),
    });
  }
}

/**
 * Likes or unlikes a bucket item: the heart and count change in the cached trip at once
 * (optimistic) and change back if the save fails. Saves for one item run one after another, so a
 * quick like-unlike lands in the order it was tapped.
 */
export function useToggleBucketLike() {
  const source = useDataSource();
  const pending = useRef(new Map<string, Promise<unknown>>());
  return useMutation(
    {
      mutationKey: LIKE_KEY,
      mutationFn: ({ item, liked }: BucketLikeChange) => {
        const save = () => (liked ? source.likeBucketItem(item) : source.unlikeBucketItem(item.id));
        const queued = (pending.current.get(item.id) ?? Promise.resolve()).then(save, save);
        pending.current.set(item.id, queued);
        const forget = () => {
          if (pending.current.get(item.id) === queued) pending.current.delete(item.id);
        };
        queued.then(forget, forget);
        return queued;
      },
      onMutate: async (change: BucketLikeChange) => {
        // Only the trip's own data: its members (a key under it) can keep loading.
        const key = dataKeys.trip(source, change.item.tripId);
        await queryClient.cancelQueries({ queryKey: key, exact: true });
        setCachedLike(source, change);
      },
      // Undo just this tap, keeping any later one.
      onError: (_error, change) => setCachedLike(source, { ...change, liked: !change.liked }),
      // Refetch once the last tap has saved, so a burst doesn't flicker through server states.
      onSettled: (_data, _error, { item }) => {
        if (queryClient.isMutating({ mutationKey: LIKE_KEY }) <= 1) {
          void queryClient.invalidateQueries({ queryKey: dataKeys.trip(source, item.tripId) });
        }
      },
    },
    queryClient,
  );
}
