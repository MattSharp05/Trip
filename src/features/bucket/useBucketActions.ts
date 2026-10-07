import { useCallback, useState } from 'react';

import type { LngLat } from '@/features/map';
import {
  useDeleteBucketItem,
  useSaveBucketItem,
  useSavePlace,
  type BucketItem,
  type PlaceInput,
} from '@/services/data';
import type { SpotResult } from '@/services/places';

import type { AddMode } from './AddPlaceSheet';
import { newBucketItem, placeFromPin, placeFromSpot, type BucketEntry } from './bucket';

/** The toast under the Plan sheet: a confirmation, optionally with Undo for a delete. */
export interface BucketToast {
  message: string;
  /** The deleted item, saved again on Undo. */
  undo?: BucketItem;
}

/**
 * The Bucket List's writes for one trip: add from search or a dropped pin, delete with Undo. The
 * Plan screen draws the Add sheet and the toast from what this returns.
 */
export function useBucketActions(tripId: string | null, bucketItems: BucketItem[] | undefined) {
  const { mutateAsync: savePlace } = useSavePlace();
  const { mutateAsync: saveItem, mutate: restoreItem } = useSaveBucketItem();
  const { mutate: deleteItem } = useDeleteBucketItem();
  const [addMode, setAddMode] = useState<AddMode | null>(null);
  const [toast, setToast] = useState<BucketToast | null>(null);
  const [saving, setSaving] = useState(false);

  const add = useCallback(
    async (place: PlaceInput, source: 'search' | 'pin') => {
      if (!tripId) return;
      setSaving(true);
      try {
        const saved = await savePlace(place);
        await saveItem(newBucketItem(tripId, saved, source));
        setAddMode(null);
        setToast({ message: `Added ${saved.name} to your Bucket List` });
      } catch {
        setToast({ message: "Couldn't save that place. Try again." });
      } finally {
        setSaving(false);
      }
    },
    [tripId, savePlace, saveItem],
  );

  const openSearch = useCallback(() => setAddMode({ kind: 'search' }), []);
  const closeSheet = useCallback(() => setAddMode(null), []);
  const pickSpot = useCallback((spot: SpotResult) => add(placeFromSpot(spot), 'search'), [add]);
  const startDropPin = useCallback(() => {
    setAddMode(null);
    setToast({ message: 'Touch and hold the map to drop a pin' });
  }, []);
  const dropPin = useCallback((coordinate: LngLat) => setAddMode({ kind: 'pin', coordinate }), []);
  const savePin = useCallback(
    (name: string) => {
      if (addMode?.kind !== 'pin' || !name.trim()) return;
      return add(placeFromPin(name, addMode.coordinate), 'pin');
    },
    [add, addMode],
  );

  const remove = useCallback(
    (entry: BucketEntry) => {
      const item = bucketItems?.find((b) => b.id === entry.id);
      if (!item) return;
      deleteItem(item.id, {
        onSuccess: () => setToast({ message: `Removed ${entry.title}`, undo: item }),
        onError: () => setToast({ message: `Couldn't remove ${entry.title}. Try again.` }),
      });
    },
    [bucketItems, deleteItem],
  );

  const undo = useCallback(() => {
    if (toast?.undo) restoreItem(toast.undo);
  }, [toast, restoreItem]);

  return {
    addMode,
    saving,
    toast,
    dismissToast: useCallback(() => setToast(null), []),
    openSearch,
    closeSheet,
    pickSpot,
    startDropPin,
    dropPin,
    savePin,
    remove,
    undo,
  };
}
