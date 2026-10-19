import { BLAKE, groupMemberSnapshot, groupSnapshot } from '@/scenarios/fixtures/group';
import { VEGAS_TRIP_ID } from '@/scenarios/fixtures/vegas';

import { createDemoSource } from '../source';
import type { TravelDocument } from './types';

const blakesPassport: TravelDocument = {
  id: 'document-blake',
  type: 'passport',
  country: 'United States',
  number: null,
  expiresOn: null,
  imagePaths: [],
  addedBy: BLAKE,
  sharedTripIds: ['trip-somewhere-else'],
};

describe('demo documents', () => {
  it("lists yours, and others' only once shared with a trip you're on", async () => {
    const source = createDemoSource({
      ...groupSnapshot,
      documents: [...groupSnapshot.documents, blakesPassport],
    });
    expect((await source.listDocuments()).map((d) => d.id)).toEqual(['document-passport']);

    const shared = createDemoSource({
      ...groupSnapshot,
      documents: [
        ...groupSnapshot.documents,
        { ...blakesPassport, sharedTripIds: [VEGAS_TRIP_ID] },
      ],
    });
    expect((await shared.listDocuments()).map((d) => d.id)).toEqual([
      'document-passport',
      'document-blake',
    ]);
  });

  it('shares your passport with a trip and stops, and the trip sees it meanwhile', async () => {
    const source = createDemoSource(groupSnapshot);
    await source.setDocumentShared('document-passport', VEGAS_TRIP_ID, true);
    const [passport] = await source.listDocuments();
    expect(passport.sharedTripIds).toEqual([VEGAS_TRIP_ID]);
    // Editing it keeps where it's shared.
    await source.saveDocument({ ...passport, country: 'Canada' });
    expect((await source.listDocuments())[0]).toMatchObject({
      country: 'Canada',
      sharedTripIds: [VEGAS_TRIP_ID],
    });
    await source.setDocumentShared('document-passport', VEGAS_TRIP_ID, false);
    expect((await source.listDocuments())[0].sharedTripIds).toEqual([]);
  });

  it("refuses to share someone else's document", async () => {
    // Willem's session: Matthew's passport (no owner set) is Matthew's, as the fixture means.
    const willem = createDemoSource({
      ...groupMemberSnapshot,
      documents: [{ ...blakesPassport, sharedTripIds: [VEGAS_TRIP_ID] }],
    });
    await expect(willem.setDocumentShared('document-blake', VEGAS_TRIP_ID, false)).rejects.toThrow(
      'owner',
    );
  });
});
