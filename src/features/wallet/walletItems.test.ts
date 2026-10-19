import { BLAKE, groupWalletSnapshot, WILLEM } from '@/scenarios/fixtures/group';
import { bookings, documents, VEGAS_TRIP_ID } from '@/scenarios/fixtures/vegas';
import type { TravelDocument } from '@/services/data/types';

import {
  buildWallet,
  documentsFor,
  EMPTY_COPY,
  filterWallet,
  scopeEmptyCopy,
  scopeWallet,
  WALLET_FILTERS,
  walletTag,
  type WalletScope,
} from './walletItems';

describe('wallet entries', () => {
  const wallet = buildWallet(bookings, documents);

  it('lists all six Vegas items: bookings by start, then documents', () => {
    expect(wallet.map((e) => e.id)).toEqual([
      'booking-flight-out',
      'booking-car',
      'booking-hotel',
      'booking-ufc',
      'booking-flight-home',
      'document-passport',
    ]);
  });

  it('does not depend on input order', () => {
    expect(buildWallet([...bookings].reverse(), documents)).toEqual(wallet);
  });

  it('filters by type for every chip', () => {
    const ids = (filter: (typeof WALLET_FILTERS)[number]['value']) =>
      filterWallet(wallet, filter).map((e) => e.id);
    expect(ids('all')).toHaveLength(6);
    expect(ids('flight')).toEqual(['booking-flight-out', 'booking-flight-home']);
    expect(ids('hotel')).toEqual(['booking-hotel']);
    expect(ids('car')).toEqual(['booking-car']);
    expect(ids('ticket')).toEqual(['booking-ufc']);
    expect(ids('document')).toEqual(['document-passport']);
  });

  it('keeps documents when a trip has no bookings', () => {
    expect(buildWallet([], documents).map((e) => e.type)).toEqual(['document']);
  });
});

describe('Mine / Shared (TR-61)', () => {
  const me = groupWalletSnapshot.me;
  const trip = VEGAS_TRIP_ID;
  const wallet = buildWallet(groupWalletSnapshot.bookings, groupWalletSnapshot.documents);
  const names: Record<string, string> = { [BLAKE]: 'Blake', [WILLEM]: 'Willem' };
  const ids = (scope: WalletScope, entries = wallet) =>
    scopeWallet(entries, scope, me, trip).map((e) => e.id);

  it('puts your flights and passport in Mine', () => {
    expect(ids('mine')).toEqual(['booking-flight-out', 'booking-flight-home', 'document-passport']);
  });

  it("puts every shared booking in Shared, anyone's, and nothing private", () => {
    expect(ids('shared')).toEqual([
      'booking-car',
      'booking-hotel',
      'booking-blake-airbnb',
      'booking-ufc',
    ]);
  });

  it("tags others' cards with who added them, and yours not at all", () => {
    const tags = Object.fromEntries(
      wallet.map((e) => [e.id, walletTag(e, me, trip, (id) => names[id])]),
    );
    expect(tags['booking-blake-airbnb']).toBe('Added by Blake');
    expect(tags['booking-car']).toBe('Added by Willem');
    expect(tags['booking-hotel']).toBeNull();
    expect(tags['document-passport']).toBeNull();
  });

  it('moves your hotel from Shared to Mine once private', () => {
    const flipped = buildWallet(
      groupWalletSnapshot.bookings.map((b) =>
        b.id === 'booking-hotel' ? { ...b, visibility: 'private' as const } : b,
      ),
      groupWalletSnapshot.documents,
    );
    expect(ids('mine', flipped)).toContain('booking-hotel');
    expect(ids('shared', flipped)).not.toContain('booking-hotel');
  });

  it("keeps a shared passport in Mine, tagged Shared, and shows others' shared with this trip", () => {
    const passport = groupWalletSnapshot.documents[0];
    const docs: TravelDocument[] = [
      { ...passport, sharedTripIds: [trip] },
      { ...passport, id: 'document-blake', addedBy: BLAKE, sharedTripIds: [trip] },
      { ...passport, id: 'document-willem', addedBy: WILLEM, sharedTripIds: ['trip-other'] },
    ];
    const shown = documentsFor(docs, me, trip);
    expect(shown.map((d) => d.id)).toEqual(['document-passport', 'document-blake']);
    const entries = buildWallet([], shown);
    expect(ids('mine', entries)).toEqual(['document-passport']);
    expect(ids('shared', entries)).toEqual(['document-blake']);
    expect(walletTag(entries[0], me, trip, (id) => names[id])).toBe('Shared');
    expect(walletTag(entries[1], me, trip, (id) => names[id])).toBe('Added by Blake');
  });

  it('before your id is known, keeps documents shared nowhere or with this trip', () => {
    const passport = groupWalletSnapshot.documents[0];
    const docs: TravelDocument[] = [
      { ...passport, addedBy: 'user-unknown-yet' },
      { ...passport, id: 'document-blake', addedBy: BLAKE, sharedTripIds: [trip] },
      { ...passport, id: 'document-willem', addedBy: WILLEM, sharedTripIds: ['trip-other'] },
    ];
    expect(documentsFor(docs, null, trip).map((d) => d.id)).toEqual([
      'document-passport',
      'document-blake',
    ]);
  });

  it('has empty-state copy for each side', () => {
    expect(scopeEmptyCopy('mine', 'all').title).toBe('Nothing private on this trip');
    expect(scopeEmptyCopy('shared', 'document').title).toBe('No shared passports or visas');
    expect(scopeEmptyCopy('shared', 'car')).toEqual(EMPTY_COPY.car);
  });
});
