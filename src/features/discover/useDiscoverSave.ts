import { useCallback, useState } from 'react';

import { useSaveBucketItem, useSavePlace, type Place, type PlaceInput } from '@/services/data';
import type { TripEvent } from '@/services/events';

import { eventBucketItem, findPlace, placeBucketItem, popularPlace, venuePlace } from './discover';
import type { PopularPlace } from './popular';

/**
 * Discover's `+`: saves an event (fixed date and time, at its venue) or a curated place to the
 * trip's Bucket List. A venue the trip already knows is reused rather than added twice.
 */
export function useDiscoverSave(tripId: string | null, places: readonly Place[] | undefined) {
  const { mutateAsync: savePlace } = useSavePlace();
  const { mutateAsync: saveItem } = useSaveBucketItem();
  const [saving, setSaving] = useState<ReadonlySet<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);

  const run = useCallback(
    async (id: string, name: string, place: PlaceInput, item: (p: Place) => Promise<unknown>) => {
      if (!tripId) return;
      setSaving((s) => new Set(s).add(id));
      try {
        const saved = findPlace(places ?? [], place) ?? (await savePlace(place));
        await item(saved);
        setToast(`Added ${name} to your Bucket List`);
      } catch {
        setToast(`Couldn't save ${name}. Try again.`);
      } finally {
        setSaving((s) => {
          const next = new Set(s);
          next.delete(id);
          return next;
        });
      }
    },
    [tripId, places, savePlace],
  );

  const saveEvent = useCallback(
    (event: TripEvent) =>
      run(event.id, event.title, venuePlace(event), (p) =>
        saveItem(eventBucketItem(tripId ?? '', event, p.id)),
      ),
    [run, saveItem, tripId],
  );

  const savePopular = useCallback(
    (place: PopularPlace) =>
      run(place.id, place.name, popularPlace(place), (p) =>
        saveItem(placeBucketItem(tripId ?? '', p)),
      ),
    [run, saveItem, tripId],
  );

  return {
    saving,
    saveEvent,
    savePopular,
    toast,
    dismissToast: useCallback(() => setToast(null), []),
  };
}
