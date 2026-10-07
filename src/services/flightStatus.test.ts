import { act, renderHook, waitFor } from '@testing-library/react-native';

import { setNow } from '@/core/clock';
import { vegasSnapshot } from '@/scenarios/fixtures/vegas';
import { queryClient } from '@/services/data/hooks';
import type { FlightData } from '@/services/data/types';
import { useScenarioStore } from '@/stores/scenario';

import { flightStatusRequest, isStatusLive, useFlightStatus } from './flightStatus';
import { invokeFunction } from './functions';

jest.mock('./functions', () => ({ invokeFunction: jest.fn() }));
const invoke = jest.mocked(invokeFunction);

const booking = vegasSnapshot.bookings.find((b) => b.id === 'booking-flight-out');
if (booking?.type !== 'flight') throw new Error('fixture flight missing');
const flight: FlightData = booking.data;

const ON_TIME = {
  state: 'active',
  delayMinutes: 0,
  departure: { terminal: 'E', gate: 'E75', revisedAt: null },
  arrival: { terminal: null, gate: null, revisedAt: null },
  updatedAt: '2026-11-12T12:41:00.000Z',
};

afterEach(() => {
  setNow(null);
  invoke.mockReset();
  queryClient.clear();
  act(() => useScenarioStore.getState().clear());
});

describe('flight status request', () => {
  it('sends the booked flight with its departure and arrival as instants', () => {
    expect(flightStatusRequest(flight)).toEqual({
      flightNumber: 'AA 2410',
      date: '2026-11-12',
      from: 'TPA',
      departsAt: '2026-11-12T14:05:00.000Z',
      arrivesAt: '2026-11-12T19:02:00.000Z',
    });
  });

  it('is live from 24 h before departure to 2 h after arrival', () => {
    expect(isStatusLive(flight, new Date('2026-11-11T14:04:00Z'))).toBe(false);
    expect(isStatusLive(flight, new Date('2026-11-11T14:05:00Z'))).toBe(true);
    expect(isStatusLive(flight, new Date('2026-11-12T21:02:00Z'))).toBe(true);
    expect(isStatusLive(flight, new Date('2026-11-12T21:03:00Z'))).toBe(false);
  });
});

describe('useFlightStatus (real account)', () => {
  it('asks the function inside the window', async () => {
    setNow('2026-11-12T07:30:00-05:00');
    invoke.mockResolvedValue({ status: ON_TIME });
    const { result } = renderHook(() => useFlightStatus(flight));
    await waitFor(() => expect(result.current).toEqual(ON_TIME));
    expect(invoke).toHaveBeenCalledWith('flight-status', flightStatusRequest(flight));
  });

  it('never calls outside the window', () => {
    setNow('2026-11-13T09:00:00-08:00');
    const { result } = renderHook(() => useFlightStatus(flight));
    expect(result.current).toBeNull();
    expect(invoke).not.toHaveBeenCalled();
  });

  it('stays quiet when the function fails (e.g. not configured)', async () => {
    setNow('2026-11-12T07:30:00-05:00');
    invoke.mockRejectedValue(new Error('Live flight status is not set up yet.'));
    const { result } = renderHook(() => useFlightStatus(flight));
    await waitFor(() => expect(invoke).toHaveBeenCalled());
    expect(result.current).toBeNull();
  });

  it('ignores a malformed answer', async () => {
    setNow('2026-11-12T07:30:00-05:00');
    invoke.mockResolvedValue({ status: { state: 'late' } });
    const { result } = renderHook(() => useFlightStatus(flight));
    await waitFor(() => expect(invoke).toHaveBeenCalled());
    expect(result.current).toBeNull();
  });
});

describe('useFlightStatus (demo session)', () => {
  it('uses the fixture status and never calls the function', async () => {
    setNow('2026-11-12T07:30:00-05:00');
    act(() => useScenarioStore.getState().start('vegas-flight-delayed', {}));
    const { result } = renderHook(() => useFlightStatus(flight));
    await waitFor(() => expect(result.current?.delayMinutes).toBe(25));
    expect(result.current?.departure.gate).toBe('E79');
    expect(invoke).not.toHaveBeenCalled();
  });
});
