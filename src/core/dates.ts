import {
  addDays,
  differenceInCalendarDays,
  eachDayOfInterval,
  format,
  parse,
  parseISO,
} from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';

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
/** "Friday, November 13" (VoiceOver) */
export const dayLabelLong = (day: string) => format(parseISO(day), 'EEEE, MMMM d');

/** "3:00 PM" from a wall-clock `HH:MM` (24h); no timezone shift, like days. */
export const timeLabel = (time: string) =>
  format(parse(time, 'HH:mm', new Date(2000, 0, 1)), 'h:mm a');

/** "Nov 12 – Nov 16, 2026", or "Dec 18, 2026 – Jan 6, 2027" across a new year. */
export function dateRangeLabel(startDate: string, endDate: string): string {
  const start = parseISO(startDate);
  const end = parseISO(endDate);
  return start.getFullYear() === end.getFullYear()
    ? `${format(start, 'MMM d')} – ${format(end, 'MMM d, yyyy')}`
    : `${format(start, 'MMM d, yyyy')} – ${format(end, 'MMM d, yyyy')}`;
}
