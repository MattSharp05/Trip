import type { Ref } from 'react';

/** A point on the map, in degrees. */
export interface LngLat {
  lat: number;
  lng: number;
}

/** One place on the map. */
export interface MapPin {
  /** The place id: the same place on several days is one pin. */
  id: string;
  coordinate: LngLat;
  /** Place kind (food, landmark, hotel, airport, car, …): picks the symbol when there's no photo. */
  kind: string;
  /** Photo URL; null draws the kind's symbol on orange. */
  photo: string | null;
  /** Shown under the pin when it's selected, and read by VoiceOver. */
  label: string;
  /** A saved place not on a day yet (Bucket List): drawn as an orange outline. */
  outlined?: boolean;
}

/** What the screen can ask the map to do (ADR 0002). */
export interface TripMapHandle {
  /** Frame these pins with padding. Unknown ids are ignored; no known ids does nothing. */
  fitTo: (ids: string[]) => void;
  /** Animate to one pin (about half a second). */
  flyTo: (id: string) => void;
}

export interface TripMapProps {
  pins: MapPin[];
  /** The day's stops in visit order, drawn as a dashed orange line. */
  routeIds: string[];
  selectedId: string | null;
  /** Pins drawn as small grey dots (other days' places). */
  dimmedIds: string[];
  /** Pins the "fit the day" button frames. Defaults to the route. */
  fitIds?: string[];
  onPinPress?: (id: string) => void;
  /** Touch and hold on the map (not on a pin): where the finger was. */
  onLongPress?: (coordinate: LngLat) => void;
  ref?: Ref<TripMapHandle>;
  testID?: string;
}
