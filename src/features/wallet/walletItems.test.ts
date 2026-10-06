import { bookings, documents } from '@/scenarios/fixtures/vegas';

import { buildWallet, filterWallet, WALLET_FILTERS } from './walletItems';

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
