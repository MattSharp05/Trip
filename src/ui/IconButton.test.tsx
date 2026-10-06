import { fireEvent, render, screen } from '@testing-library/react-native';
import { SymbolView } from 'expo-symbols';
import { StyleSheet } from 'react-native';

import { colors } from '@/theme';

import { IconButton } from './IconButton';

describe('IconButton', () => {
  it('has a spoken label and presses', () => {
    const onPress = jest.fn();
    render(<IconButton icon="plus" label="Add trip" onPress={onPress} />);
    fireEvent.press(screen.getByRole('button', { name: 'Add trip' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('filled is an orange circle with a white glyph', () => {
    const { UNSAFE_getByType } = render(
      <IconButton icon="plus" label="Add" variant="filled" size="lg" testID="b" />,
    );
    expect(StyleSheet.flatten(screen.getByTestId('b').props.style)).toMatchObject({
      backgroundColor: colors.accent,
      width: 44,
      height: 44,
    });
    expect(UNSAFE_getByType(SymbolView).props.tintColor).toBe(colors.onAccent);
  });

  it('turns the glyph orange when selected', () => {
    const { UNSAFE_getByType } = render(
      <IconButton icon="heart" label="Saved" variant="plain" selected />,
    );
    expect(screen.getByRole('button', { name: 'Saved' })).toBeSelected();
    expect(UNSAFE_getByType(SymbolView).props.tintColor).toBe(colors.accent);
  });
});
