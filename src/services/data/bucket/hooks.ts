import { useMutation } from '@tanstack/react-query';

import { withLike } from '@/core/bucket';

import { useDataSource } from '../active';
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

/**
 * Likes or unlikes a bucket item: the heart and count change in the cached trip at once
 * (optimistic) and go back if the save fails.
 */
export function useToggleBucketLike() {
  const source = useDataSource();
  return useMutation(
    {
      mutationFn: ({ item, liked }: BucketLikeChange) =>
        liked ? source.likeBucketItem(item) : source.unlikeBucketItem(item.id),
      onMutate: async ({ item, me, liked }: BucketLikeChange) => {
        const key = dataKeys.trip(source, item.tripId);
        await queryClient.cancelQueries({ queryKey: key });
        const previous = queryClient.getQueryData<TripData | null>(key);
        if (previous) {
          queryClient.setQueryData<TripData>(key, {
            ...previous,
            bucketItems: withLike(previous.bucketItems, item.id, me, liked),
          });
        }
        return { previous };
      },
      onError: (_error, { item }, context) => {
        if (context?.previous) {
          queryClient.setQueryData(dataKeys.trip(source, item.tripId), context.previous);
        }
      },
      onSettled: () => queryClient.invalidateQueries({ queryKey: dataKeys.all(source) }),
    },
    queryClient,
  );
}
