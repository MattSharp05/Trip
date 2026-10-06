import { expiryWarning, validUntilNeeded } from './expiry';

const trip = (city: string, startDate: string, endDate: string) => ({
  city,
  startDate,
  endDate,
  timezone: 'America/Los_Angeles',
});

const newYork = trip('New York', '2026-10-16', '2026-10-20');
const vegas = trip('Las Vegas', '2026-11-12', '2026-11-16');
const tokyo = trip('Tokyo', '2027-03-20', '2027-03-29');
const trips = [tokyo, vegas, newYork];
// Fri, Nov 13 2026, 9:00 AM in Las Vegas (the scenarios' "today"): New York is past.
const at = new Date('2026-11-13T09:00:00-08:00');

describe('validUntilNeeded', () => {
  it('is the trip end plus six months', () => {
    expect(validUntilNeeded(vegas)).toBe('2027-05-16');
    expect(validUntilNeeded(tokyo)).toBe('2027-09-29');
  });

  it('clamps to the month end', () => {
    expect(validUntilNeeded(trip('X', '2026-08-25', '2026-08-31'))).toBe('2027-02-28');
  });
});

describe('expiryWarning', () => {
  it('stays quiet for a passport valid long after every trip', () => {
    expect(expiryWarning('2034-06-30', trips, at)).toBeNull();
  });

  it('warns when it expires within six months of an upcoming trip end', () => {
    expect(expiryWarning('2027-05-15', trips, at)).toEqual({ kind: 'too-soon', trip: vegas });
  });

  it('names the soonest upcoming trip it does not cover', () => {
    // Covers Las Vegas (needs May 16) but not Tokyo (needs Sep 29).
    expect(expiryWarning('2027-08-15', trips, at)).toEqual({ kind: 'too-soon', trip: tokyo });
  });

  it('is fine on exactly the day six months after the trip ends', () => {
    expect(expiryWarning('2027-09-29', trips, at)).toBeNull();
  });

  it('ignores past trips', () => {
    // New York ended Oct 20 (needs Apr 20, 2027); Las Vegas needs May 16.
    expect(expiryWarning('2027-05-01', [newYork], at)).toBeNull();
  });

  it('counts a trip in progress as upcoming', () => {
    expect(expiryWarning('2027-01-01', [vegas], at)).toEqual({ kind: 'too-soon', trip: vegas });
  });

  it('reports an expired document first', () => {
    expect(expiryWarning('2026-11-01', trips, at)).toEqual({ kind: 'expired' });
  });

  it('never warns without an expiry date or without upcoming trips', () => {
    expect(expiryWarning(null, trips, at)).toBeNull();
    expect(expiryWarning('2026-12-01', [], at)).toBeNull();
  });
});
