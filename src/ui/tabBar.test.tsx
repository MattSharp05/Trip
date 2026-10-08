import { renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { FLOATING_TAB_BAR, useTabBarInset } from './tabBar';

function inset(bottom: number) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 402, height: 874 },
        insets: { top: 62, left: 0, right: 0, bottom },
      }}
    >
      {children}
    </SafeAreaProvider>
  );
  return renderHook(() => useTabBarInset(), { wrapper }).result.current;
}

describe('useTabBarInset', () => {
  it('clears the floating tab bar above the home indicator', () => {
    expect(inset(34)).toBe(34 + FLOATING_TAB_BAR);
  });

  it('clears the tab bar on a phone without a home indicator too', () => {
    expect(inset(0)).toBe(FLOATING_TAB_BAR);
  });
});
