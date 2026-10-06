import { act, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, Animated } from 'react-native';

import { Skeleton } from './Skeleton';

describe('Skeleton', () => {
  afterEach(() => jest.restoreAllMocks());

  async function renderWithReduceMotion(enabled: boolean) {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(enabled);
    const loop = jest.spyOn(Animated, 'loop');
    render(<Skeleton height={20} testID="skeleton" />);
    await act(async () => {});
    return loop;
  }

  it('pulses normally', async () => {
    const loop = await renderWithReduceMotion(false);
    expect(loop).toHaveBeenCalled();
    expect(screen.getByLabelText('Loading')).toBeOnTheScreen();
  });

  it('holds still when Reduce Motion is on', async () => {
    const loop = await renderWithReduceMotion(true);
    expect(loop).not.toHaveBeenCalled();
    expect(screen.getByTestId('skeleton')).toHaveStyle({ opacity: 1 });
  });
});
