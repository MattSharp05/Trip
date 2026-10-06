import { timezoneAt } from '@/core/timezone';
import type { NewTrip } from '@/services/data';
import type { PlaceResult } from '@/services/places';
import type { CoverPhoto } from '@/services/photos';

/** "Lisbon, Portugal" (with the region for US-style places: "Portland, Oregon, United States"). */
export function placeLabel(place: PlaceResult): string {
  return [place.name, place.region, place.country].filter(Boolean).join(', ');
}

/**
 * The trip to save for a picked destination and dates: the destination's timezone from its
 * coordinates, and a cover photo when one is found. A failed photo lookup never blocks saving; the
 * card shows the plain surface instead.
 */
export async function buildNewTrip(
  place: PlaceResult,
  startDate: string,
  endDate: string,
  findCoverPhoto: (query: string) => Promise<CoverPhoto | null>,
): Promise<{ trip: NewTrip; photo: CoverPhoto | null }> {
  let photo: CoverPhoto | null = null;
  try {
    photo = await findCoverPhoto([place.name, place.country].filter(Boolean).join(' '));
  } catch {
    photo = null;
  }
  return {
    photo,
    trip: {
      city: place.name,
      country: place.country,
      lat: place.lat,
      lng: place.lng,
      timezone: timezoneAt(place.lat, place.lng),
      startDate,
      endDate,
      coverPhotoUrl: photo?.url ?? null,
      coverPhotoCredit: photo
        ? {
            source: 'unsplash',
            photographer: photo.photographer,
            photographerUrl: photo.photographerUrl,
            photoUrl: photo.photoUrl,
          }
        : null,
    },
  };
}
