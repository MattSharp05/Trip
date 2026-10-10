import { vegasSnapshot } from '@/scenarios/fixtures/vegas';

import { createDemoSource } from '../source';

describe('demo places', () => {
  it('adds a place and a bucket item that uses it', async () => {
    const source = createDemoSource(vegasSnapshot);
    const place = await source.savePlace({
      name: 'Eggslut',
      address: null,
      lat: 36.11,
      lng: -115.17,
      kind: 'food',
      photoUrl: null,
      sourceUrl: null,
    });
    expect(place.id).toMatch(/^place-/);
    await source.saveBucketItem({
      ...vegasSnapshot.bucketItems[0],
      id: 'b-new',
      placeId: place.id,
    });
    const data = (await source.getTripData('trip-vegas'))!;
    expect(data.bucketItems).toHaveLength(6);
    expect(data.places.find((p) => p.id === place.id)?.name).toBe('Eggslut');
  });
});
