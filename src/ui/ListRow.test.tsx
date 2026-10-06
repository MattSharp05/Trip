import { fireEvent, render, screen } from '@testing-library/react-native';
import { SymbolView } from 'expo-symbols';
import { StyleSheet } from 'react-native';

import { colors } from '@/theme';

import { ListRow } from './ListRow';

describe('ListRow', () => {
  it('shows title, subtitle, value, icon and a chevron when tappable', () => {
    const onPress = jest.fn();
    const { UNSAFE_getAllByType } = render(
      <ListRow
        icon="airplane"
        title="Flights"
        subtitle="2 bookings"
        value="$486"
        onPress={onPress}
      />,
    );
    expect(screen.getByText('Flights')).toBeOnTheScreen();
    expect(screen.getByText('2 bookings')).toBeOnTheScreen();
    expect(screen.getByText('$486')).toBeOnTheScreen();
    expect(UNSAFE_getAllByType(SymbolView).map((s) => s.props.name)).toEqual([
      'airplane',
      'chevron.right',
    ]);
    fireEvent.press(screen.getByRole('button'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('has no chevron or button role when not tappable', () => {
    const { UNSAFE_queryAllByType } = render(<ListRow title="Terminal 8" testID="row" />);
    expect(UNSAFE_queryAllByType(SymbolView)).toHaveLength(0);
    expect(screen.queryByRole('button')).toBeNull();
    // Read-only, not "dimmed" to VoiceOver.
    expect(screen.getByTestId('row')).not.toBeDisabled();
  });

  it('draws a hairline separator on request and colours the value', () => {
    render(<ListRow title="AA 100" value="On time" valueTone="ok" separator testID="row" />);
    expect(StyleSheet.flatten(screen.getByTestId('row').props.style).borderBottomColor).toBe(
      colors.hairline,
    );
    expect(StyleSheet.flatten(screen.getByText('On time').props.style).color).toBe(colors.ok);
  });
});
