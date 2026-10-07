import {
  dateRangeLabel,
  dayIn,
  dayLabel,
  dayLabelLong,
  dayOfMonth,
  daysBetween,
  instantIn,
  monthDayLabel,
  shiftDay,
  timeAsDate,
  timeLabel,
  timeOfDate,
  tripDays,
  weekdayShort,
} from './dates';

describe('dates', () => {
  it('lists every trip day, both ends included', () => {
    expect(tripDays('2026-11-12', '2026-11-16')).toEqual([
      '2026-11-12',
      '2026-11-13',
      '2026-11-14',
      '2026-11-15',
      '2026-11-16',
    ]);
    expect(tripDays('2026-12-31', '2027-01-01')).toEqual(['2026-12-31', '2027-01-01']);
    expect(tripDays('2026-11-13', '2026-11-13')).toEqual(['2026-11-13']);
    expect(tripDays('2026-11-16', '2026-11-12')).toEqual([]);
  });

  it('crosses a daylight-saving change without skipping or doubling a day', () => {
    expect(tripDays('2026-10-31', '2026-11-02')).toEqual([
      '2026-10-31',
      '2026-11-01',
      '2026-11-02',
    ]);
  });

  it('finds the date in a timezone', () => {
    const instant = new Date('2026-11-13T07:30:00Z');
    expect(dayIn('America/Los_Angeles', instant)).toBe('2026-11-12');
    expect(dayIn('Europe/London', instant)).toBe('2026-11-13');
  });

  it('shifts and counts days', () => {
    expect(shiftDay('2026-11-13', 15)).toBe('2026-11-28');
    expect(shiftDay('2026-03-01', -1)).toBe('2026-02-28');
    expect(daysBetween('2026-11-12', '2026-11-16')).toBe(4);
    expect(daysBetween('2026-11-16', '2026-11-12')).toBe(-4);
  });

  it('formats labels', () => {
    expect(weekdayShort('2026-11-13')).toBe('Fri');
    expect(dayOfMonth('2026-11-13')).toBe('13');
    expect(dayLabel('2026-11-13')).toBe('Fri, Nov 13');
    expect(dayLabelLong('2026-11-13')).toBe('Friday, November 13');
    expect(monthDayLabel('2026-11-14')).toBe('Nov 14');
    expect(dateRangeLabel('2026-11-12', '2026-11-16')).toBe('Nov 12 – Nov 16, 2026');
    expect(dateRangeLabel('2026-12-18', '2027-01-06')).toBe('Dec 18, 2026 – Jan 6, 2027');
  });

  it('formats wall-clock times as "9:00 AM"', () => {
    expect(timeLabel('09:00')).toBe('9:00 AM');
    expect(timeLabel('15:00')).toBe('3:00 PM');
    expect(timeLabel('00:05')).toBe('12:05 AM');
    expect(timeLabel('12:00')).toBe('12:00 PM');
  });

  it('round-trips a wall-clock time through a time picker value', () => {
    expect(timeAsDate('15:05').getHours()).toBe(15);
    expect(timeOfDate(timeAsDate('15:05'))).toBe('15:05');
    expect(timeOfDate(new Date(2026, 10, 13, 9, 30))).toBe('09:30');
  });

  it('turns a wall-clock time in a timezone into an instant', () => {
    expect(instantIn('America/Los_Angeles', '2026-11-13', '12:00')).toBe(
      '2026-11-13T20:00:00.000Z',
    );
    expect(instantIn('Asia/Tokyo', '2026-11-13', '12:00')).toBe('2026-11-13T03:00:00.000Z');
    expect(dayIn('Asia/Tokyo', new Date(instantIn('Asia/Tokyo', '2026-11-13', '12:00')))).toBe(
      '2026-11-13',
    );
  });
});
