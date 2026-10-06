/** A point on the map, in degrees. */
export interface LngLat {
  lat: number;
  lng: number;
}

/** One itinerary stop shown as a photo pin. */
export interface SpikePin extends LngLat {
  id: string;
  title: string;
  /** Short time label, e.g. "10:00 AM". */
  time: string;
  /** Image URI (a data URI in the spike, so both renderers can show it offline). */
  photo: string;
}

/** The spike's three tabs. */
export type SpikeTab = 'apple' | 'maplibre' | 'globe';
