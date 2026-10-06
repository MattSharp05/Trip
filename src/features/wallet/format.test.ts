import {
  brandCode,
  formatDateTime,
  formatDay,
  formatMonthYear,
  formatNights,
  formatTime,
  formatWeekdayDay,
  nightsBetween,
} from './format';

describe('wallet formatting', () => {
  it('formats dates as written, with the right weekday', () => {
    expect(formatDay('2026-11-12')).toBe('Nov 12');
    expect(formatWeekdayDay('2026-11-12')).toBe('Thu, Nov 12');
    expect(formatWeekdayDay('2027-01-03')).toBe('Sun, Jan 3');
    expect(formatMonthYear('2034-06-30')).toBe('Jun 2034');
  });

  it('formats 24h times as 12h', () => {
    expect(formatTime('09:05')).toBe('9:05 AM');
    expect(formatTime('00:30')).toBe('12:30 AM');
    expect(formatTime('12:00')).toBe('12:00 PM');
    expect(formatTime('18:00')).toBe('6:00 PM');
    expect(
      formatDateTime({ date: '2026-11-15', time: '18:00', timezone: 'America/Los_Angeles' }),
    ).toBe('Sun, Nov 15, 6:00 PM');
  });

  it('counts nights across a month end', () => {
    expect(nightsBetween('2026-11-12', '2026-11-16')).toBe(4);
    expect(nightsBetween('2026-12-30', '2027-01-02')).toBe(3);
    expect(formatNights(1)).toBe('1 night');
    expect(formatNights(4)).toBe('4 nights');
  });

  it('makes brand code badges', () => {
    expect(brandCode('Hertz')).toBe('H');
    expect(brandCode('Enterprise Rent-A-Car')).toBe('ER');
    expect(brandCode('National Car Rental')).toBe('NC');
  });
});
