import { invokeFunction } from './functions';

/** A cover photo from the `photos` Edge Function (Unsplash, hotlinked). */
export interface CoverPhoto {
  url: string;
  photographer: string;
  photographerUrl: string;
  photoUrl: string;
  downloadLocation: string;
}

/** The best landscape photo for a destination, or null (no match, or no Unsplash key yet). */
export async function findCoverPhoto(query: string): Promise<CoverPhoto | null> {
  const { photo } = await invokeFunction<{ photo: CoverPhoto | null }>('photos', {
    action: 'search',
    query,
  });
  return photo;
}

/** Tell Unsplash the photo was chosen (their API guidelines require it). */
export async function trackPhotoDownload(downloadLocation: string): Promise<void> {
  await invokeFunction('photos', { action: 'track', downloadLocation });
}
