import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { colors, radii, spacing } from '@/theme';

import { Surface } from './Surface';

describe('Surface', () => {
  it('is a surface card with a hairline border, card radius and no shadow', () => {
    render(<Surface testID="card" />);
    const style = StyleSheet.flatten(screen.getByTestId('card').props.style);
    expect(style).toMatchObject({
      backgroundColor: colors.surface,
      borderColor: colors.hairline,
      borderRadius: radii.card,
      borderCurve: 'continuous',
      padding: spacing.lg,
    });
    expect(style).not.toHaveProperty('shadowOpacity');
  });

  it('supports the raised level and no padding', () => {
    render(<Surface testID="card" level="raised" padding="none" />);
    const style = StyleSheet.flatten(screen.getByTestId('card').props.style);
    expect(style.backgroundColor).toBe(colors.raised);
    expect(style).not.toHaveProperty('padding');
  });
});
