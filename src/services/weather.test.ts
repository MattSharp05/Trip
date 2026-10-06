import { act, renderHook, waitFor } from '@testing-library/react-native';

import { setNow } from '@/core/clock';
import { queryClient } from '@/services/data/hooks';
import { useScenarioStore } from '@/stores/scenario';

import { fetchForecast, forecastWindow, useTripForecast } from './weather';

const LA = 'America/Los_Angeles';
const trip = (startDate: string, endDate: string) => ({
  lat: 36.1147,
  lng: -115.1728,
  timezone: LA,
  startDate,
  endDate,
});
// Tue, Oct 6 2026, 9:00 AM in Las Vegas.
const TODAY = new Date('2026-10-06T09:00:00-07:00');

describe('forecastWindow', () => {
  it('covers a whole trip inside the next 16 days', () => {
    expect(forecastWindow(trip('2026-10-10', '2026-10-14'), TODAY)).toEqual({
      from: '2026-10-10',
      to: '2026-10-14',
    });
  });

  it('stops at the 16th day, today included', () => {
    expect(forecastWindow(trip('2026-10-18', '2026-10-25'), TODAY)).toEqual({
      from: '2026-10-18',
      to: '2026-10-21',
    });
  });

  it('is empty for a trip that starts beyond the forecast', () => {
    expect(forecastWindow(trip('2026-11-12', '2026-11-16'), TODAY)).toBeNull();
    expect(forecastWindow(trip('2026-10-22', '2026-10-24'), TODAY)).toBeNull();
  });

  it('starts at today for a trip underway, and is empty once it is over', () => {
    expect(forecastWindow(trip('2026-10-03', '2026-10-08'), TODAY)).toEqual({
      from: '2026-10-06',
      to: '2026-10-08',
    });
    expect(forecastWindow(trip('2026-09-20', '2026-09-25'), TODAY)).toBeNull();
  });

  it("uses the trip's timezone for today", () => {
    // 11:30 PM Oct 5 in Las Vegas is already Oct 6 in UTC.
    const lateEvening = new Date('2026-10-06T06:30:00Z');
    expect(forecastWindow(trip('2026-10-05', '2026-10-05'), lateEvening)).toEqual({
      from: '2026-10-05',
      to: '2026-10-05',
    });
  });
});

describe('fetchForecast', () => {
  const fetchMock = jest.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  const respond = (body: unknown, ok = true, status = 200) =>
    fetchMock.mockResolvedValue({ ok, status, json: () => Promise.resolve(body) });

  it('asks Open-Meteo for the daily forecast at the place, in its timezone', async () => {
    respond({
      daily: { time: [], weather_code: [], temperature_2m_max: [], temperature_2m_min: [] },
    });
    await fetchForecast({ lat: 36.1147, lng: -115.1728, timezone: LA }, '2026-10-10', '2026-10-14');
    const url = new URL(fetchMock.mock.calls[0][0]);
    expect(url.origin + url.pathname).toBe('https://api.open-meteo.com/v1/forecast');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      latitude: '36.1147',
      longitude: '-115.1728',
      daily: 'weather_code,temperature_2m_max,temperature_2m_min',
      timezone: LA,
      start_date: '2026-10-10',
      end_date: '2026-10-14',
    });
  });

  it('returns each day in °C and leaves out days with no data', async () => {
    respond({
      daily: {
        time: ['2026-10-10', '2026-10-11', '2026-10-12'],
        weather_code: [0, 61, null],
        temperature_2m_max: [29.4, 24.1, null],
        temperature_2m_min: [16.2, 14, null],
      },
    });
    const forecast = await fetchForecast(
      { lat: 36.1, lng: -115.2, timezone: LA },
      '2026-10-10',
      '2026-10-12',
    );
    expect(forecast).toEqual({
      '2026-10-10': { day: '2026-10-10', code: 0, highC: 29.4, lowC: 16.2 },
      '2026-10-11': { day: '2026-10-11', code: 61, highC: 24.1, lowC: 14 },
    });
  });

  it('fails on an error response, so the query reports it', async () => {
    respond({ error: true, reason: 'out of range' }, false, 400);
    await expect(
      fetchForecast({ lat: 1, lng: 2, timezone: LA }, '2026-10-10', '2026-10-12'),
    ).rejects.toThrow('Open-Meteo 400');
  });
});

describe('useTripForecast', () => {
  const fetchMock = jest.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
    setNow(TODAY);
  });
  afterEach(() => {
    setNow(null);
    queryClient.clear();
    act(() => useScenarioStore.getState().clear());
  });

  it('shows the real forecast for a trip within 16 days', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          daily: {
            time: ['2026-10-10', '2026-10-11'],
            weather_code: [2, 3],
            temperature_2m_max: [28, 26],
            temperature_2m_min: [15, 14],
          },
        }),
    });
    const { result } = renderHook(() => useTripForecast(trip('2026-10-10', '2026-10-11')));
    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data?.['2026-10-10']).toEqual({
      day: '2026-10-10',
      code: 2,
      highC: 28,
      lowC: 15,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('asks for nothing when the trip is beyond the forecast', async () => {
    const { result } = renderHook(() => useTripForecast(trip('2026-11-12', '2026-11-16')));
    await act(async () => {});
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.data).toBeUndefined();
  });

  it('asks for nothing when the trip has no location', async () => {
    const { result } = renderHook(() =>
      useTripForecast({ ...trip('2026-10-10', '2026-10-11'), lat: null, lng: null }),
    );
    await act(async () => {});
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.data).toBeUndefined();
  });

  it('gives a demo session fixture weather for every day, offline', async () => {
    act(() => useScenarioStore.getState().start('vegas-plan-day-2', {}));
    const { result } = renderHook(() => useTripForecast(trip('2026-11-12', '2026-11-16')));
    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(Object.keys(result.current.data ?? {})).toHaveLength(5);
    expect(result.current.data?.['2026-11-13']).toMatchObject({ highC: 23.9, lowC: 12.8 });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
