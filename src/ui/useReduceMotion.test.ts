import { act, renderHook } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import { useReduceMotion } from './useReduceMotion';

describe('useReduceMotion', () => {
  afterEach(() => jest.restoreAllMocks());

  it('is undefined until read, then follows the setting and its changes', async () => {
    let listener: ((enabled: boolean) => void) | undefined;
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    jest.spyOn(AccessibilityInfo, 'addEventListener').mockImplementation((_event, handler) => {
      listener = handler as unknown as (enabled: boolean) => void;
      return { remove: jest.fn() } as never;
    });

    const { result } = renderHook(() => useReduceMotion());
    expect(result.current).toBeUndefined();
    await act(async () => {});
    expect(result.current).toBe(true);

    act(() => listener?.(false));
    expect(result.current).toBe(false);
  });
});
