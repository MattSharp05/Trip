import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { Toast } from './Toast';

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
});
