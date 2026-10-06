import { act, renderHook } from '@testing-library/react-native';
import type { RefObject } from 'react';
import type MapView from 'react-native-maps';

import { spin } from './spin';
import { useGlobeSpin } from './useGlobeSpin';

function fakeMap(center = { latitude: 0, longitude: 0 }) {
  const setCamera = jest.fn();
  const getCamera = jest.fn(async () => ({ center, pitch: 0, heading: 0, altitude: 1 }));
  const ref = { current: { setCamera, getCamera } } as unknown as RefObject<MapView | null>;
  return { ref, setCamera, getCamera };
}

const lastLng = (setCamera: jest.Mock) =>
  setCamera.mock.calls[setCamera.mock.calls.length - 1][0].center.longitude;

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

it('turns the globe west while active', () => {
  const { ref, setCamera } = fakeMap();
  renderHook(() => useGlobeSpin(ref, { lat: 20, lng: 0 }, true));
  act(() => jest.advanceTimersByTime(1000));
  expect(setCamera).toHaveBeenCalled();
  expect(lastLng(setCamera)).toBeCloseTo(-spin.degreesPerSecond, 0);
  expect(setCamera.mock.calls[0][0].center.latitude).toBe(20);
});

it('stays still while inactive (Reduce Motion, not ready, off screen)', () => {
  const { ref, setCamera } = fakeMap();
  const { rerender } = renderHook(
    ({ on }: { on: boolean }) => useGlobeSpin(ref, { lat: 0, lng: 0 }, on),
    {
      initialProps: { on: false },
    },
  );
  act(() => jest.advanceTimersByTime(2000));
  expect(setCamera).not.toHaveBeenCalled();

  rerender({ on: true });
  act(() => jest.advanceTimersByTime(500));
  expect(setCamera).toHaveBeenCalled();

  setCamera.mockClear();
  rerender({ on: false });
  act(() => jest.advanceTimersByTime(2000));
  expect(setCamera).not.toHaveBeenCalled();
});

it('stops under a finger and carries on from where the user dragged it', async () => {
  const { ref, setCamera, getCamera } = fakeMap({ latitude: -30, longitude: 100 });
  const { result } = renderHook(() => useGlobeSpin(ref, { lat: 0, lng: 0 }, true));

  act(() => result.current.touchHandlers.onTouchStart());
  setCamera.mockClear();
  act(() => jest.advanceTimersByTime(1000));
  expect(setCamera).not.toHaveBeenCalled();

  act(() => result.current.touchHandlers.onTouchEnd());
  act(() => jest.advanceTimersByTime(spin.resumeAfterMs - 100));
  expect(setCamera).not.toHaveBeenCalled();
  await act(async () => jest.advanceTimersByTime(100));
  expect(getCamera).toHaveBeenCalled();
  act(() => jest.advanceTimersByTime(500));
  expect(setCamera).toHaveBeenCalled();
  expect(setCamera.mock.calls[0][0].center.latitude).toBe(-30);
  expect(lastLng(setCamera)).toBeLessThan(100);
  expect(lastLng(setCamera)).toBeGreaterThan(97);
});
