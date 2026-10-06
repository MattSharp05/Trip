import { fireEvent, render, screen } from '@testing-library/react-native';
import { SymbolView } from 'expo-symbols';
import { StyleSheet } from 'react-native';

import { colors } from '@/theme';

import { Button } from './Button';

describe('Button', () => {
  it('primary is orange', () => {
    render(<Button label="View Boarding Pass" testID="btn" />);
    expect(StyleSheet.flatten(screen.getByTestId('btn').props.style).backgroundColor).toBe(
      colors.accent,
    );
  });

  it('secondary is grey with a hairline', () => {
    render(<Button label="Add to Calendar" variant="secondary" testID="btn" />);
    expect(StyleSheet.flatten(screen.getByTestId('btn').props.style)).toMatchObject({
      backgroundColor: colors.raised,
      borderColor: colors.hairline,
    });
  });

  it('shows an icon when given one', () => {
    const { UNSAFE_getByType } = render(<Button label="Pass" icon="qrcode" />);
    expect(UNSAFE_getByType(SymbolView).props.name).toBe('qrcode');
  });

  it('presses, unless disabled', () => {
    const onPress = jest.fn();
    const { rerender } = render(<Button label="Save" onPress={onPress} />);
    fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    expect(onPress).toHaveBeenCalledTimes(1);

    rerender(<Button label="Save" onPress={onPress} disabled />);
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
