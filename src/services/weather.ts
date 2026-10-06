import { useQuery } from '@tanstack/react-query';

import { now } from '@/core/clock';
import { dayIn, daysBetween, shiftDay } from '@/core/dates';
import type { DailyForecast } from '@/core/weather';
import { demoForecast } from '@/scenarios/fixtures/weather';
import { queryClient } from '@/services/data/hooks';
import type { Trip } from '@/services/data/types';
import { useScenarioStore } from '@/stores/scenario';

/** Open-Meteo's forecast API: free, no key (TDD → External services). */
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';

/** The forecast reaches 16 days, today included. Later days get no weather, never made-up data. */
export const FORECAST_DAYS = 16;

export type ForecastPlace = Pick<Trip, 'lat' | 'lng' | 'timezone' | 'startDate' | 'endDate'>;

/**
 * The part of a trip the forecast covers, given "today": from today (or the first day, if later)
 * to the last trip day within the forecast range. Null when no trip day is in range.
 */
export function forecastWindow(
  trip: ForecastPlace,
  instant: Date,
): { from: string; to: string } | null {
  const today = dayIn(trip.timezone, instant);
  const lastForecastDay = shiftDay(today, FORECAST_DAYS - 1);
  const from = daysBetween(today, trip.startDate) > 0 ? trip.startDate : today;
  const to = daysBetween(trip.endDate, lastForecastDay) > 0 ? trip.endDate : lastForecastDay;
  return daysBetween(from, to) >= 0 ? { from, to } : null;
}

interface OpenMeteoDaily {
  time: string[];
  weather_code: (number | null)[];
  temperature_2m_max: (number | null)[];
  temperature_2m_min: (number | null)[];
}

/** One request for the days `from`–`to` at a trip's location, in its timezone, in °C. */
export async function fetchForecast(
  place: Pick<Trip, 'timezone'> & { lat: number; lng: number },
  from: string,
  to: string,
): Promise<DailyForecast> {
  const params = new URLSearchParams({
    latitude: String(place.lat),
    longitude: String(place.lng),
    daily: 'weather_code,temperature_2m_max,temperature_2m_min',
    timezone: place.timezone,
    start_date: from,
    end_date: to,
  });
  const res = await fetch(`${FORECAST_URL}?${params}`);
  if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
  const { daily } = (await res.json()) as { daily?: OpenMeteoDaily };
  const forecast: DailyForecast = {};
  daily?.time.forEach((day, i) => {
    const code = daily.weather_code[i];
    const highC = daily.temperature_2m_max[i];
    const lowC = daily.temperature_2m_min[i];
    // Open-Meteo sends nulls for days its models don't cover yet: no data, no weather.
    if (code == null || highC == null || lowC == null) return;
    forecast[day] = { day, code, highC, lowC };
  });
  return forecast;
}

/**
 * The daily forecast for a trip's days, cached per location and day range (an hour fresh). A demo
 * session (scenario) gets deterministic fixture weather and never touches the network. Days
 * without weather are simply missing; errors leave the pills without weather too.
 */
export function useTripForecast(trip: ForecastPlace | undefined) {
  const scenario = useScenarioStore((s) => s.active);
  const instant = now();
  const window = trip ? forecastWindow(trip, instant) : null;
  const { lat, lng } = trip ?? {};
  const located = lat != null && lng != null;
  return useQuery(
    {
      queryKey: [
        'weather',
        scenario ?? 'live',
        lat,
        lng,
        trip?.timezone,
        scenario ? trip?.startDate : window?.from,
        scenario ? trip?.endDate : window?.to,
      ],
      queryFn: (): Promise<DailyForecast> => {
        if (!trip) return Promise.resolve({});
        if (scenario) return Promise.resolve(demoForecast(trip.startDate, trip.endDate));
        if (!window || lat == null || lng == null) return Promise.resolve({});
        return fetchForecast({ lat, lng, timezone: trip.timezone }, window.from, window.to);
      },
      enabled: !!trip && (scenario !== null || (located && window !== null)),
      staleTime: 60 * 60 * 1000,
    },
    queryClient,
  );
}
