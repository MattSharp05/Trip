import { act, fireEvent, render as rntlRender, screen } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { FLOATING_TAB_BAR } from './tabBar';
import { Toast } from './Toast';

/** An iPhone with a home indicator: 34 pt bottom safe area. */
const metrics = {
  frame: { x: 0, y: 0, width: 402, height: 874 },
  insets: { top: 62, left: 0, right: 0, bottom: 34 },
};

function wrap(ui: ReactElement) {
  return <SafeAreaProvider initialMetrics={metrics}>{ui}</SafeAreaProvider>;
}

function render(ui: ReactElement) {
  const result = rntlRender(wrap(ui));
  return { ...result, rerender: (next: ReactElement) => result.rerender(wrap(next)) };
}

describe('Toast', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('renders nothing when hidden', () => {
    render(<Toast visible={false} message="Saved" onDismiss={() => {}} />);
    expect(screen.queryByText('Saved')).toBeNull();
  });

  it('runs the action and closes', () => {
    const onAction = jest.fn();
    const onDismiss = jest.fn();
    render(
      <Toast
        visible
        message="Added to Day 3"
        actionLabel="Undo"
        onAction={onAction}
        onDismiss={onDismiss}
      />,
    );
    expect(screen.getByText('Added to Day 3')).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: 'Undo' }));
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('closes on its own after the duration', () => {
    const onDismiss = jest.fn();
    render(<Toast visible message="Saved" onDismiss={onDismiss} duration={3000} />);
    act(() => jest.advanceTimersByTime(2999));
    expect(onDismiss).not.toHaveBeenCalled();
    act(() => jest.advanceTimersByTime(1));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('gives a new message the full duration, and ignores new callbacks', () => {
    const onDismiss = jest.fn();
    const { rerender } = render(
      <Toast visible message="Added A" onDismiss={() => onDismiss()} duration={3000} />,
    );
    act(() => jest.advanceTimersByTime(2500));
    rerender(<Toast visible message="Added B" onDismiss={() => onDismiss()} duration={3000} />);
    act(() => jest.advanceTimersByTime(2500));
    expect(onDismiss).not.toHaveBeenCalled();
    rerender(<Toast visible message="Added B" onDismiss={() => onDismiss()} duration={3000} />);
    act(() => jest.advanceTimersByTime(500));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  // TR-33 QA round 2: on a real iPhone the toast rendered under the floating tab bar.
  it('floats above the tab bar by default', () => {
    render(<Toast visible message="Added" onDismiss={() => {}} testID="toast" />);
    const style = StyleSheet.flatten(screen.getByTestId('toast').props.style);
    expect(style.position).toBe('absolute');
    expect(style.bottom).toBe(34 + FLOATING_TAB_BAR);
  });

  it('sits just above the home indicator on screens without a tab bar', () => {
    render(
      <Toast visible message="Signed out" onDismiss={() => {}} placement="screen" testID="toast" />,
    );
    const style = StyleSheet.flatten(screen.getByTestId('toast').props.style);
    expect(style.bottom).toBeGreaterThan(34);
    expect(style.bottom).toBeLessThan(34 + FLOATING_TAB_BAR);
  });
});
