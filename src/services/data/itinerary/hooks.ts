import { useMutation } from '@tanstack/react-query';

import { useDataSource } from '../active';
import { resplitsForGoing } from '../expenses/resplit';
import { dataKeys, queryClient, useWrite } from '../shared/query';
import type { TripData } from '../types';
import { withGoing } from './optOuts';
import type { ItineraryItem } from './types';

export const useSaveItineraryItem = () =>
  useWrite((s, item: ItineraryItem) => s.saveItineraryItem(item));
export const useDeleteItineraryItem = () => useWrite((s, id: string) => s.deleteItineraryItem(id));

/**
 * I'm going / I'm out on a stop (TR-60), applied to the cached trip at once (the switch moves
 * straight away) and rolled back if the save fails. The stop's expenses still split equally
 * between everyone going are then split again for who is going now (TR-66); `memberIds` is
 * everyone on the trip.
 */
export function useSetGoing(
  tripId: string | null,
  me: string | null,
  memberIds: readonly string[] = [],
) {
  const source = useDataSource();
  const key = dataKeys.trip(source, tripId ?? '');
  return useMutation(
    {
      mutationFn: async ({ itemId, going }: { itemId: string; going: boolean }) => {
        if (!tripId) throw new Error('No trip');
        // Read before the switch saves; the opt-outs it compares come from `going`, not the cache.
        const data = queryClient.getQueryData<TripData | null>(key);
        const item = data?.items.find((i) => i.id === itemId);
        const resplits =
          data && item && me ? resplitsForGoing(data.expenses, item, memberIds, me, going) : [];
        await (going ? source.optIn(itemId) : source.optOut(itemId, tripId));
        await Promise.all(resplits.map((r) => source.setExpenseShares(r.expenseId, r.shares)));
      },
      onMutate: async ({ itemId, going }) => {
        await queryClient.cancelQueries({ queryKey: key });
        const previous = queryClient.getQueryData<TripData | null>(key);
        if (previous && me) {
          queryClient.setQueryData<TripData>(key, {
            ...previous,
            items: previous.items.map((i) => (i.id === itemId ? withGoing(i, me, going) : i)),
          });
        }
        return { previous };
      },
      onError: (_error, _vars, context) => {
        if (context?.previous) queryClient.setQueryData(key, context.previous);
      },
      onSettled: () => queryClient.invalidateQueries({ queryKey: dataKeys.all(source) }),
    },
    queryClient,
  );
}
