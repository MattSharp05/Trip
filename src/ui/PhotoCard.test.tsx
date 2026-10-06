import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { photoScrim, radii } from '@/theme';

import { PhotoCard } from './PhotoCard';

const photo = { uri: 'https://example.com/nyc.jpg' };

describe('PhotoCard', () => {
  it('shows the title and subtitle over a scrimmed photo with photo-card corners', () => {
    render(<PhotoCard source={photo} title="New York" subtitle="Oct 16 – Oct 20" testID="card" />);
    expect(screen.getByText('New York')).toBeOnTheScreen();
    expect(screen.getByText('Oct 16 – Oct 20')).toBeOnTheScreen();
    expect(StyleSheet.flatten(screen.getByTestId('card').props.style).borderRadius).toBe(
      radii.photo,
    );
    expect(
      StyleSheet.flatten(screen.getByTestId('card-scrim').props.style).experimental_backgroundImage,
    ).toBe(photoScrim);
  });

  it('is a button only when it has an action', () => {
    const onPress = jest.fn();
    const { rerender } = render(<PhotoCard source={photo} title="Las Vegas" />);
    expect(screen.queryByRole('button')).toBeNull();

    rerender(<PhotoCard source={photo} title="Las Vegas" subtitle="Nov 12" onPress={onPress} />);
    fireEvent.press(screen.getByRole('button', { name: 'Las Vegas, Nov 12' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('falls back to the plain surface when there is no photo', () => {
    render(<PhotoCard source={null} title="Lisbon" testID="card" />);
    expect(screen.getByText('Lisbon')).toBeOnTheScreen();
    expect(screen.queryByTestId('card-photo')).toBeNull();
    expect(screen.queryByTestId('card-scrim')).toBeNull();
  });
});
