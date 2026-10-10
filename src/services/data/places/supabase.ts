import { check, checkRow, client, type Row } from '../shared/supabase';
import type { Place, PlacesSource } from './types';

export const toPlace = (r: Row<'places'>): Place => ({
  id: r.id,
  name: r.name,
  address: r.address,
  lat: r.lat,
  lng: r.lng,
  kind: r.kind,
  photoUrl: r.photo_url,
  sourceUrl: r.source_url,
});

/** The places slice of the Supabase source. */
export const supabasePlaces: PlacesSource = {
  async savePlace(place) {
    const supabase = client();
    const row = checkRow(
      await supabase
        .from('places')
        .upsert({
          ...(place.id ? { id: place.id } : {}),
          name: place.name,
          address: place.address,
          lat: place.lat,
          lng: place.lng,
          kind: place.kind,
          photo_url: place.photoUrl,
          source_url: place.sourceUrl,
        })
        .select()
        .single(),
    );
    return toPlace(row);
  },
  async deletePlace(id) {
    const supabase = client();
    check(await supabase.from('places').delete().eq('id', id));
  },
};
