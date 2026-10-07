import { useMutation } from '@tanstack/react-query';
import { useCallback, useState } from 'react';

import { dataKeys, queryClient, useDataSource, type ItineraryItem } from '@/services/data';
import type { TripData } from '@/services/data/types';

import { applyEdit, type EditPlan, type ItineraryEdit } from './edits';

/** The toast under the Plan sheet after an edit: what happened, and Undo after a delete. */
export interface EditToast {
  message: string;
  /** The deleted item, saved again on Undo. */
  undo?: ItineraryItem;
}

/**
 * Itinerary writes for one trip, applied to the cached trip at once (optimistic) and rolled back
 * with a message if the save fails. Travel legs and the map follow, since they derive from it.
 */
export function useItineraryEdits(tripId: string | null) {
  const source = useDataSource();
  const [toast, setToast] = useState<EditToast | null>(null);
  const key = dataKeys.trip(source, tripId ?? '');

  const { mutate } = useMutation(
    {
      mutationFn: async (edit: ItineraryEdit) => {
        await Promise.all([
          ...edit.save.map((item) => source.saveItineraryItem(item)),
          ...edit.remove.map((id) => source.deleteItineraryItem(id)),
        ]);
      },
      onMutate: async (edit: ItineraryEdit) => {
        await queryClient.cancelQueries({ queryKey: key });
        const previous = queryClient.getQueryData<TripData | null>(key);
        if (previous) queryClient.setQueryData(key, applyEdit(previous, edit));
        return { previous };
      },
      onError: (_error, _edit, context) => {
        if (context?.previous) queryClient.setQueryData(key, context.previous);
        setToast({ message: "Couldn't save that change. Try again." });
      },
      onSettled: () => queryClient.invalidateQueries({ queryKey: dataKeys.all(source) }),
    },
    queryClient,
  );

  /** Run a planned edit, or show why it can't happen. True when it ran. */
  const run = useCallback(
    (plan: EditPlan, done?: string): boolean => {
      if ('message' in plan) {
        setToast({ message: plan.message });
        return false;
      }
      if (plan.edit.save.length || plan.edit.remove.length) mutate(plan.edit);
      if (done) setToast({ message: done });
      return true;
    },
    [mutate],
  );

  const remove = useCallback(
    (item: ItineraryItem, title: string) => {
      mutate({ save: [], remove: [item.id] });
      setToast({ message: `Removed ${title}`, undo: item });
    },
    [mutate],
  );

  const undo = useCallback(() => {
    if (toast?.undo) mutate({ save: [toast.undo], remove: [] });
  }, [toast, mutate]);

  return {
    run,
    remove,
    undo,
    toast,
    showMessage: useCallback((message: string) => setToast({ message }), []),
    dismissToast: useCallback(() => setToast(null), []),
  };
}
