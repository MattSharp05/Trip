import { createDemoSource } from '@/services/data';
import type { DataSnapshot, TravelDocument } from '@/services/data/types';

import { emptyForm, formError, formFrom, MAX_PHOTOS, toInput } from './form';

const passport: TravelDocument = {
  id: 'document-passport',
  type: 'passport',
  country: 'United States',
  number: '567890123',
  expiresOn: '2034-06-30',
  imagePaths: ['u1/documents/a.jpg'],
};

describe('document form', () => {
  it('requires a country and an expiry date', () => {
    expect(formError(emptyForm())).toBe('Add the issuing country.');
    expect(formError({ ...emptyForm(), country: '  ' })).toBe('Add the issuing country.');
    expect(formError({ ...emptyForm(), country: 'Japan' })).toBe('Add the expiry date.');
    expect(formError({ ...emptyForm(), country: 'Japan', expiresOn: '2030-01-01' })).toBeNull();
  });

  it('round-trips a document and trims what was typed', () => {
    const form = { ...formFrom(passport), country: ' United States ', number: ' 567  890 ' };
    expect(toInput(form, passport.id)).toEqual({
      ...passport,
      number: '567 890',
    });
  });

  it('saves an empty number as null, a new document without an id, and at most four photos', () => {
    const photos = ['a', 'b', 'c', 'd', 'e'].map((p) => `file:///${p}.jpg`);
    const input = toInput({
      type: 'visa',
      country: 'India',
      number: '',
      expiresOn: '2027-01-01',
      imagePaths: photos,
    });
    expect(input).not.toHaveProperty('id');
    expect(input.number).toBeNull();
    expect(input.imagePaths).toHaveLength(MAX_PHOTOS);
  });
});

describe('demo source documents', () => {
  const empty: DataSnapshot = {
    trips: [],
    places: [],
    items: [],
    bookings: [],
    bucketItems: [],
    expenses: [],
    documents: [],
  };

  it('adds, updates and deletes documents without touching the network', async () => {
    const source = createDemoSource(empty);
    const { id: _id, ...fields } = passport;
    const added = await source.saveDocument(fields);
    expect(added.id).toMatch(/^document-/);
    expect(await source.listDocuments()).toEqual([added]);

    await source.saveDocument({ ...added, country: 'Canada' });
    expect((await source.listDocuments())[0].country).toBe('Canada');

    await source.deleteDocument(added.id);
    expect(await source.listDocuments()).toEqual([]);
  });
});
