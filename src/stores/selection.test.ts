import { act, renderHook } from '@testing-library/react-native';

import { setNow } from '@/core/clock';

import { useScenarioStore } from './scenario';
import { openingDay, useSelectionStore, useTripSelection } from './selection';

const trip = {
  id: 'trip-vegas',
  startDate: '2026-11-12',
  endDate: '2026-11-16',
  timezone: 'America/Los_Angeles',
};

afterEach(() => {
  setNow(null);
  act(() => useScenarioStore.getState().clear());
});

describe('openingDay', () => {
  const before = new Date('2026-10-06T12:00:00Z');
  it("uses the scenario's day when it is a trip day", () => {
    expect(openingDay(trip, { day: '2026-11-14' }, before)).toBe('2026-11-14');
    expect(openingDay(trip, { day: '2026-12-01' }, before)).toBe('2026-11-12');
  });

  it("opens on today while the trip is underway, in the trip's timezone", () => {
    // 1 AM UTC on the 14th is still the 13th in Las Vegas.
    expect(openingDay(trip, {}, new Date('2026-11-14T01:00:00Z'))).toBe('2026-11-13');
  });

  it('opens on the first day before or after the trip', () => {
    expect(openingDay(trip, {}, before)).toBe('2026-11-12');
    expect(openingDay(trip, {}, new Date('2026-12-01T12:00:00Z'))).toBe('2026-11-12');
  });
});

describe('useTripSelection', () => {
  it('starts on the opening day, then follows selectDay', () => {
    setNow('2026-11-15T10:00:00-08:00');
    const { result } = renderHook(() => useTripSelection(trip));
    expect(result.current.selectedDay).toBe('2026-11-15');
    expect(useSelectionStore.getState()).toMatchObject({
      tripId: 'trip-vegas',
      selectedDay: '2026-11-15',
    });
    act(() => result.current.selectDay('2026-11-13'));
    expect(result.current.selectedDay).toBe('2026-11-13');
  });

  it("takes the scenario's day and item, and starts over when a scenario loads", () => {
    act(() => useScenarioStore.getState().start('a', { day: '2026-11-12', itemId: 'item-01' }));
    const { result } = renderHook(() => useTripSelection(trip));
    expect(result.current).toMatchObject({ selectedDay: '2026-11-12', selectedItemId: 'item-01' });

    act(() => result.current.selectDay('2026-11-16'));
    expect(result.current).toMatchObject({ selectedDay: '2026-11-16', selectedItemId: null });

    act(() => useScenarioStore.getState().start('b', { day: '2026-11-14' }));
    expect(result.current.selectedDay).toBe('2026-11-14');
  });

  it('keeps the item when only the item changes', () => {
    const { result } = renderHook(() => useTripSelection(trip));
    act(() => result.current.selectItem('item-07'));
    expect(result.current.selectedItemId).toBe('item-07');
  });
});
