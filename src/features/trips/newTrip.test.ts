import type { PlaceResult } from '@/services/places';

import { buildNewTrip, placeLabel } from './newTrip';

const lisbon: PlaceResult = {
  id: 'R5400890',
  name: 'Lisbon',
  region: null,
  country: 'Portugal',
  countryCode: 'PT',
  lat: 38.7077507,
  lng: -9.1365919,
};

const photo = {
  url: 'https://images.unsplash.com/photo-1',
  photographer: 'Ana Lisboa',
  photographerUrl: 'https://unsplash.com/@ana?utm_source=trip_demo&utm_medium=referral',
  photoUrl: 'https://unsplash.com/photos/abc?utm_source=trip_demo&utm_medium=referral',
  downloadLocation: 'https://api.unsplash.com/photos/abc/download',
};

describe('buildNewTrip', () => {
  it("saves the destination's timezone and the cover photo with its credit", async () => {
    const find = jest.fn(async () => photo);
    const { trip } = await buildNewTrip(lisbon, '2027-04-03', '2027-04-08', find);
    expect(find).toHaveBeenCalledWith('Lisbon Portugal');
    expect(trip).toEqual({
      city: 'Lisbon',
      country: 'Portugal',
      lat: 38.7077507,
      lng: -9.1365919,
      timezone: 'Europe/Lisbon',
      startDate: '2027-04-03',
      endDate: '2027-04-08',
      coverPhotoUrl: photo.url,
      coverPhotoCredit: {
        source: 'unsplash',
        photographer: 'Ana Lisboa',
        photographerUrl: photo.photographerUrl,
        photoUrl: photo.photoUrl,
      },
    });
  });

  it('saves without a cover when there is no photo or the lookup fails', async () => {
    for (const find of [async () => null, async () => Promise.reject(new Error('offline'))]) {
      const { trip, photo: found } = await buildNewTrip(lisbon, '2027-04-03', '2027-04-08', find);
      expect(found).toBeNull();
      expect(trip).toMatchObject({ coverPhotoUrl: null, coverPhotoCredit: null });
    }
  });

  it('labels places with region and country', () => {
    expect(placeLabel(lisbon)).toBe('Lisbon, Portugal');
    expect(placeLabel({ ...lisbon, region: 'Iowa', country: 'United States' })).toBe(
      'Lisbon, Iowa, United States',
    );
  });
});
