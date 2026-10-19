import { useMutation } from '@tanstack/react-query';

import { useDataSource } from '../active';
import { dataKeys, queryClient, useWrite } from '../shared/query';
import type { TripData } from '../types';
import type { ItineraryItem } from './types';

export const useSaveItineraryItem = () =>
  useWrite((s, item: ItineraryItem) => s.saveItineraryItem(item));
export const useDeleteItineraryItem = () => useWrite((s, id: string) => s.deleteItineraryItem(id));

/** The stop with you in or out of it (TR-60). */
export function withGoing(item: ItineraryItem, me: string, going: boolean): ItineraryItem {
  const others = (item.optedOut ?? []).filter((id) => id !== me);
  return { ...item, optedOut: going ? others : [...others, me] };
}

/**
 * I'm going / I'm out on a stop (TR-60), applied to the cached trip at once (the switch moves
 * straight away) and rolled back if the save fails.
 */
export function useSetGoing(tripId: string | null, me: string | null) {
  const source = useDataSource();
  const key = dataKeys.trip(source, tripId ?? '');
  return useMutation(
    {
      mutationFn: ({ itemId, going }: { itemId: string; going: boolean }) =>
        going ? source.optIn(itemId) : source.optOut(itemId, tripId ?? ''),
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
