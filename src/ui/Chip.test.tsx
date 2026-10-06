import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { colors } from '@/theme';

import { Chip } from './Chip';

describe('Chip', () => {
  it('is grey when not selected', () => {
    render(<Chip label="Hotels" testID="chip" />);
    const chip = screen.getByRole('button', { name: 'Hotels' });
    expect(chip).not.toBeSelected();
    expect(StyleSheet.flatten(screen.getByTestId('chip').props.style).backgroundColor).toBe(
      colors.raised,
    );
  });

  it('is orange when selected', () => {
    render(<Chip label="All" selected testID="chip" />);
    expect(screen.getByRole('button', { name: 'All' })).toBeSelected();
    expect(StyleSheet.flatten(screen.getByTestId('chip').props.style).backgroundColor).toBe(
      colors.accent,
    );
  });

  it('calls onPress', () => {
    const onPress = jest.fn();
    render(<Chip label="Cars" onPress={onPress} />);
    fireEvent.press(screen.getByRole('button', { name: 'Cars' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
