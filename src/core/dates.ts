import {
  addDays,
  differenceInCalendarDays,
  eachDayOfInterval,
  format,
  parse,
  parseISO,
} from 'date-fns';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';

/**
 * Calendar-day helpers. Days are `YYYY-MM-DD` wall-clock dates in the trip's timezone (see
 * `services/data/types.ts`), so they are parsed as plain local dates and never shifted by a
 * timezone: only "today" depends on one.
 */

/** Every day of a trip, first to last inclusive. Empty when the range is backwards. */
export function tripDays(startDate: string, endDate: string): string[] {
  const start = parseISO(startDate);
  const end = parseISO(endDate);
  if (end < start) return [];
  return eachDayOfInterval({ start, end }).map((d) => format(d, 'yyyy-MM-dd'));
}

/** The calendar date it is at `instant` in `timezone`. */
export function dayIn(timezone: string, instant: Date): string {
  return formatInTimeZone(instant, timezone, 'yyyy-MM-dd');
}

/** The instant (ISO, UTC) it is at wall-clock `day` `time` (`HH:MM`) in `timezone`. */
export function instantIn(timezone: string, day: string, time: string): string {
  return fromZonedTime(`${day}T${time}:00`, timezone).toISOString();
}

/** `day` moved by `n` days (negative goes back). */
export function shiftDay(day: string, n: number): string {
  return format(addDays(parseISO(day), n), 'yyyy-MM-dd');
}

/** Whole days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: string, to: string): number {
  return differenceInCalendarDays(parseISO(to), parseISO(from));
}

/** "Fri" */
export const weekdayShort = (day: string) => format(parseISO(day), 'EEE');
/** "13" */
export const dayOfMonth = (day: string) => format(parseISO(day), 'd');
/** "Fri, Nov 13" */
export const dayLabel = (day: string) => format(parseISO(day), 'EEE, MMM d');
/** "Nov 14" */
export const monthDayLabel = (day: string) => format(parseISO(day), 'MMM d');
/** "Friday, November 13" (VoiceOver) */
export const dayLabelLong = (day: string) => format(parseISO(day), 'EEEE, MMMM d');

/** "3:00 PM" from a wall-clock `HH:MM` (24h); no timezone shift, like days. */
export const timeLabel = (time: string) =>
  format(parse(time, 'HH:mm', new Date(2000, 0, 1)), 'h:mm a');

/** A time picker's value for a wall-clock `HH:MM`; only its hours and minutes matter. */
export const timeAsDate = (time: string) => parse(time, 'HH:mm', new Date(2000, 0, 1));

/** The wall-clock `HH:MM` a time picker shows. */
export const timeOfDate = (date: Date) => format(date, 'HH:mm');

/** "Nov 12 – 16" within a month, "Dec 18 – Jan 6" across months: no year, for section titles. */
export function shortRangeLabel(startDate: string, endDate: string): string {
  const start = parseISO(startDate);
  const end = parseISO(endDate);
  if (startDate === endDate) return format(start, 'MMM d');
  return startDate.slice(0, 7) === endDate.slice(0, 7)
    ? `${format(start, 'MMM d')} – ${format(end, 'd')}`
    : `${format(start, 'MMM d')} – ${format(end, 'MMM d')}`;
}

/** "Nov 12 – Nov 16, 2026", or "Dec 18, 2026 – Jan 6, 2027" across a new year. */
export function dateRangeLabel(startDate: string, endDate: string): string {
  const start = parseISO(startDate);
  const end = parseISO(endDate);
  return start.getFullYear() === end.getFullYear()
    ? `${format(start, 'MMM d')} – ${format(end, 'MMM d, yyyy')}`
    : `${format(start, 'MMM d, yyyy')} – ${format(end, 'MMM d, yyyy')}`;
}
