import { tripDays } from '@/core/dates';
import type { DailyForecast } from '@/core/weather';

// Clear November days in the desert, in °C (75°/55°F on the trip's Friday, as in the mockup).
const PATTERN = [
  { code: 0, highC: 22.8, lowC: 12.2 },
  { code: 0, highC: 23.9, lowC: 12.8 },
  { code: 1, highC: 23.3, lowC: 13.3 },
  { code: 2, highC: 21.7, lowC: 11.7 },
  { code: 3, highC: 20.6, lowC: 11.1 },
];

/**
 * Deterministic weather for demo sessions: every trip day gets a forecast, whatever the pinned
 * "today", so scenario QA always shows weather. Demo data only; real accounts never see it.
 */
export function demoForecast(startDate: string, endDate: string): DailyForecast {
  const forecast: DailyForecast = {};
  tripDays(startDate, endDate).forEach((day, i) => {
    forecast[day] = { day, ...PATTERN[i % PATTERN.length] };
  });
  return forecast;
}
