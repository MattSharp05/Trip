import { useMutation } from '@tanstack/react-query';
import { useCallback, useState } from 'react';

import { dataKeys, queryClient, useDataSource, type TripData } from '@/services/data';

import type { BucketEntry } from './bucket';
import { planBucketAll } from './planAll';
import { applyChange, planBucketSmartAdd, type SmartAddChange } from './smartAdd';

/** The toast after Smart Add: where it went, with Undo (the writes that put everything back). */
export interface SmartAddToast {
  message: string;
  undo?: SmartAddChange;
}

/** Where a Smart Add landed, for the screen to switch to that day and select the new stop. */
export interface SmartAddPlaced {
  itemId: string;
  day: string;
}

/**
 * Smart Add for one trip (TR-29): places a bucket item with the planner (`core/smartAdd`), moves it
 * from the Bucket List to the itinerary in one optimistic write, and keeps one Undo record that
 * snapshots everything it changed (the new stop, the bucket item, any stop it moved).
 * `planAll` (Plan my bucket list, TR-32) does the same for every item at once, with one Undo for
 * the whole set, and keeps a note on each item that didn't fit.
 */
export function useSmartAdd(tripId: string | null, data: TripData | null | undefined) {
  const source = useDataSource();
  const [toast, setToast] = useState<SmartAddToast | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const key = dataKeys.trip(source, tripId ?? '');

  const { mutate } = useMutation(
    {
      mutationFn: async (change: SmartAddChange) => {
        await Promise.all([
          ...change.save.map((item) => source.saveItineraryItem(item)),
          ...change.remove.map((id) => source.deleteItineraryItem(id)),
          ...change.saveBucket.map((item) => source.saveBucketItem(item)),
          ...change.removeBucket.map((id) => source.deleteBucketItem(id)),
        ]);
      },
      onMutate: async (change: SmartAddChange) => {
        await queryClient.cancelQueries({ queryKey: key });
        const previous = queryClient.getQueryData<TripData | null>(key);
        if (previous) queryClient.setQueryData(key, applyChange(previous, change));
        return { previous };
      },
      onError: (_error, _change, context) => {
        if (context?.previous) queryClient.setQueryData(key, context.previous);
        setToast({ message: "Couldn't save that change. Try again." });
      },
      onSettled: () => queryClient.invalidateQueries({ queryKey: dataKeys.all(source) }),
    },
    queryClient,
  );

  /** Place `entry` in the trip. Returns where it went, or null when it didn't fit. */
  const add = useCallback(
    (entry: BucketEntry): SmartAddPlaced | null => {
      const bucketItem = data?.bucketItems.find((b) => b.id === entry.id);
      if (!data || !bucketItem) return null;
      const plan = planBucketSmartAdd(data, bucketItem);
      if (!('change' in plan)) {
        setToast({ message: plan.message });
        return null;
      }
      mutate(plan.change);
      setToast({ message: plan.message, undo: plan.undo });
      return { itemId: plan.itemId, day: plan.day };
    },
    [data, mutate],
  );

  /**
   * Place every bucket item that fits. Returns the earliest new stop when everything fit; null
   * when something stayed in the list (its note says why) or nothing could be placed.
   */
  const planAll = useCallback((): SmartAddPlaced | null => {
    if (!data || data.bucketItems.length === 0) return null;
    const plan = planBucketAll(data);
    setNotes(plan.notes);
    if (!plan.change || !plan.undo) {
      setToast({ message: plan.message });
      return null;
    }
    mutate(plan.change);
    setToast({ message: plan.message, undo: plan.undo });
    return Object.keys(plan.notes).length === 0 ? plan.first : null;
  }, [data, mutate]);

  const undo = useCallback(() => {
    if (!toast?.undo) return;
    mutate(toast.undo);
    setNotes({});
  }, [toast, mutate]);

  return {
    add,
    planAll,
    notes,
    undo,
    toast,
    dismissToast: useCallback(() => setToast(null), []),
  };
}
