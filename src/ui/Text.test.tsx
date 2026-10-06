import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { colors, typography } from '@/theme';

import { Text } from './Text';

describe('Text', () => {
  it('defaults to body in primary text colour', () => {
    render(<Text>Central Park</Text>);
    const style = StyleSheet.flatten(screen.getByText('Central Park').props.style);
    expect(style).toMatchObject({ ...typography.body, color: colors.textPrimary });
  });

  it('applies the variant and tone', () => {
    render(
      <Text variant="largeTitle" tone="secondary">
        My Trips
      </Text>,
    );
    const style = StyleSheet.flatten(screen.getByText('My Trips').props.style);
    expect(style).toMatchObject({ fontSize: 32, fontWeight: '700', color: colors.textSecondary });
  });

  it('uses the semantic green for ok', () => {
    render(<Text tone="ok">On time</Text>);
    expect(StyleSheet.flatten(screen.getByText('On time').props.style).color).toBe(colors.ok);
  });
});
