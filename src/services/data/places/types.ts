export interface Place {
  id: string;
  name: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  /** food, landmark, hotel, airport, car, arena, bar, nightlife, attraction */
  kind: string | null;
  photoUrl: string | null;
  sourceUrl: string | null;
}

/** What "save a place" takes; without an id it adds a new one. */
export type PlaceInput = Omit<Place, 'id'> & { id?: string };

/** The places slice of `DataSource`. */
export interface PlacesSource {
  /** Adds a place (no id) or updates one; returns it with its id. */
  savePlace(place: PlaceInput): Promise<Place>;
  deletePlace(id: string): Promise<void>;
}
