import { useQuery } from '@tanstack/react-query';

import { queryClient, type PhotoCredit } from '@/services/data';
import { findCoverPhoto } from '@/services/photos';

export interface HotelPhoto {
  url: string;
  /** Unsplash photos need a credit line; the place's own photo doesn't. */
  credit: PhotoCredit | null;
}

/**
 * The hotel's hero photo: the place's own photo when it has one, else the best Unsplash match from
 * the `photos` function. Null while it loads, when nothing matches, and until the Unsplash key is
 * set: the screen then shows its plain placeholder.
 */
export function useHotelPhoto(placePhotoUrl: string | null, query: string): HotelPhoto | null {
  const search = useQuery(
    {
      queryKey: ['photos', 'hotel', query],
      queryFn: () => findCoverPhoto(query),
      enabled: !placePhotoUrl && query.trim().length > 0,
      staleTime: Infinity,
      retry: false,
    },
    queryClient,
  );
  if (placePhotoUrl) return { url: placePhotoUrl, credit: null };
  const photo = search.data;
  if (!photo) return null;
  return {
    url: photo.url,
    credit: {
      source: 'unsplash',
      photographer: photo.photographer,
      photographerUrl: photo.photographerUrl,
      photoUrl: photo.photoUrl,
    },
  };
}
