import { timezoneAt } from './timezone';

describe('timezoneAt', () => {
  it('finds the IANA zone from coordinates, offline', () => {
    expect(timezoneAt(38.7077, -9.1366)).toBe('Europe/Lisbon');
    expect(timezoneAt(36.1147, -115.1728)).toBe('America/Los_Angeles');
    expect(timezoneAt(35.6762, 139.6503)).toBe('Asia/Tokyo');
    expect(timezoneAt(-33.9249, 18.4241)).toBe('Africa/Johannesburg');
  });

  it('falls back to UTC for impossible coordinates', () => {
    expect(timezoneAt(123, 456)).toBe('UTC');
  });
});
