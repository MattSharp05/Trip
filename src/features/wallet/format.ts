import type { LocalDateTime } from '@/services/data/types';

/**
 * Wallet copy for dates and times. Fixture and database values are local wall-clock strings
 * (`YYYY-MM-DD`, `HH:MM`) in the place's own timezone, so these format the strings as written and
 * never convert through the device's timezone.
 */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function parts(date: string): { year: number; month: number; day: number } {
  const [year, month, day] = date.split('-').map(Number);
  return { year, month, day };
}

/** `2026-11-12` → `Nov 12`. */
export function formatDay(date: string): string {
  const { month, day } = parts(date);
  return `${MONTHS[month - 1]} ${day}`;
}

/** `2026-11-12` → `Thu, Nov 12`. */
export function formatWeekdayDay(date: string): string {
  const { year, month, day } = parts(date);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return `${WEEKDAYS[weekday]}, ${formatDay(date)}`;
}

/** `2034-06-30` → `Jun 2034`. */
export function formatMonthYear(date: string): string {
  const { year, month } = parts(date);
  return `${MONTHS[month - 1]} ${year}`;
}

/** `09:05` → `9:05 AM`, `18:00` → `6:00 PM`. */
export function formatTime(time: string): string {
  const [hours, minutes] = time.split(':').map(Number);
  const suffix = hours < 12 ? 'AM' : 'PM';
  const hour = hours % 12 === 0 ? 12 : hours % 12;
  return `${hour}:${String(minutes).padStart(2, '0')} ${suffix}`;
}

/** `Thu, Nov 12, 9:05 AM`. */
export function formatDateTime(at: LocalDateTime): string {
  return `${formatWeekdayDay(at.date)}, ${formatTime(at.time)}`;
}

/** Nights between two dates (check-in → check-out). */
export function nightsBetween(from: string, to: string): number {
  const a = parts(from);
  const b = parts(to);
  const ms = Date.UTC(b.year, b.month - 1, b.day) - Date.UTC(a.year, a.month - 1, a.day);
  return Math.max(0, Math.round(ms / 86_400_000));
}

/** `1 night`, `4 nights`. */
export function formatNights(nights: number): string {
  return `${nights} ${nights === 1 ? 'night' : 'nights'}`;
}

/** A brand's code badge from its name: initials of the first two words, or one letter. */
export function brandCode(name: string): string {
  const words = name.split(/[\s-]+/).filter(Boolean);
  return words
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
}
