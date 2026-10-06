import { useMemo, type Ref } from 'react';

import type { ItineraryItem, Place } from '@/services/data/types';

import { dayPins } from './pins';
import { TripMap } from './TripMap';
import type { TripMapHandle } from './types';

export interface TripDayMapProps {
  /** The trip's places and itinerary (from `useTripData`). */
  data: { places: Place[]; items: ItineraryItem[] };
  /** The day in focus, `YYYY-MM-DD`. Until TR-12's day store, the Plan screen passes it in. */
  focusDay: string;
  selectedId?: string | null;
  onPinPress?: (id: string) => void;
  ref?: Ref<TripMapHandle>;
}

/** The trip map with one day in focus: its stops as photo pins with the route, the rest as dots. */
export function TripDayMap({
  data,
  focusDay,
  selectedId = null,
  onPinPress,
  ref,
}: TripDayMapProps) {
  const { pins, routeIds, dimmedIds } = useMemo(() => dayPins(data, focusDay), [data, focusDay]);
  return (
    <TripMap
      ref={ref}
      pins={pins}
      routeIds={routeIds}
      dimmedIds={dimmedIds}
      selectedId={selectedId}
      onPinPress={onPinPress}
    />
  );
}
