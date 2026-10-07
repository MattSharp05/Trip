import { useMemo, type Ref } from 'react';

import type { ItineraryItem, Place } from '@/services/data/types';

import { dayPins } from './pins';
import { TripMap } from './TripMap';
import type { LngLat, MapPin, TripMapHandle } from './types';

export interface TripDayMapProps {
  /** The trip's places and itinerary (from `useTripData`). */
  data: { places: Place[]; items: ItineraryItem[] };
  /** The day in focus, `YYYY-MM-DD`. Until TR-12's day store, the Plan screen passes it in. */
  focusDay: string;
  selectedId?: string | null;
  onPinPress?: (id: string) => void;
  /** More pins over the day's (the Bucket List's outlined ones); a place already pinned is skipped. */
  extraPins?: MapPin[];
  /** What the map frames instead of the day's route (e.g. the extra pins). */
  fitIds?: string[];
  onLongPress?: (coordinate: LngLat) => void;
  /** A travel day: the plane button that shows the flight on the globe. */
  onShowFlight?: () => void;
  ref?: Ref<TripMapHandle>;
}

/** The trip map with one day in focus: its stops as photo pins with the route, the rest as dots. */
export function TripDayMap({
  data,
  focusDay,
  selectedId = null,
  onPinPress,
  extraPins,
  fitIds,
  onLongPress,
  onShowFlight,
  ref,
}: TripDayMapProps) {
  const { pins, routeIds, dimmedIds } = useMemo(() => dayPins(data, focusDay), [data, focusDay]);
  const allPins = useMemo(() => {
    if (!extraPins?.length) return pins;
    const ids = new Set(pins.map((p) => p.id));
    return [...pins, ...extraPins.filter((p) => !ids.has(p.id))];
  }, [pins, extraPins]);
  return (
    <TripMap
      ref={ref}
      pins={allPins}
      fitIds={fitIds}
      onLongPress={onLongPress}
      onShowFlight={onShowFlight}
      routeIds={routeIds}
      dimmedIds={dimmedIds}
      selectedId={selectedId}
      onPinPress={onPinPress}
    />
  );
}
