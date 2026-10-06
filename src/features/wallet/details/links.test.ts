import type { Place } from '@/services/data/types';

import { destinationOf, directionsUrl, emailUrl, phoneUrl, websiteUrl } from './links';

const place: Place = {
  id: 'p',
  name: 'T-Mobile Arena',
  address: '3780 Las Vegas Blvd S, Las Vegas, NV',
  lat: 36.1029,
  lng: -115.1784,
  kind: 'arena',
  photoUrl: null,
  sourceUrl: null,
};

describe('directions', () => {
  it('routes to the address, encoded for Apple Maps', () => {
    expect(directionsUrl(destinationOf(place)!)).toBe(
      'http://maps.apple.com/?daddr=3780%20Las%20Vegas%20Blvd%20S%2C%20Las%20Vegas%2C%20NV',
    );
  });

  it("prefers the booking's own address over the place's", () => {
    expect(destinationOf(place, '1 Main St')?.address).toBe('1 Main St');
  });

  it('falls back to the position when there is no address', () => {
    expect(directionsUrl({ address: null, lat: 36.1, lng: -115.2 })).toBe(
      'http://maps.apple.com/?daddr=36.1%2C-115.2',
    );
  });

  it('has nowhere to go without an address or a position', () => {
    expect(directionsUrl({ address: '  ', lat: null, lng: 1 })).toBeNull();
    expect(destinationOf(undefined)).toBeNull();
  });
});

describe('contact links', () => {
  it('dials the digits of a phone number', () => {
    expect(phoneUrl('+1 702-698-7000')).toBe('tel:+17026987000');
    expect(phoneUrl('(702) 698 7000')).toBe('tel:7026987000');
    expect(phoneUrl(null)).toBeNull();
    expect(phoneUrl('n/a')).toBeNull();
  });

  it('adds https to a bare website', () => {
    expect(websiteUrl('cosmopolitanlasvegas.com')).toBe('https://cosmopolitanlasvegas.com');
    expect(websiteUrl('http://example.com')).toBe('http://example.com');
    expect(websiteUrl(' ')).toBeNull();
  });

  it('mails an address', () => {
    expect(emailUrl('stay@hotel.com')).toBe('mailto:stay@hotel.com');
    expect(emailUrl(null)).toBeNull();
  });
});
