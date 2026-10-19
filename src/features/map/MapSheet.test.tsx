import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { MapSheet } from './MapSheet';

const layout = (height: number) => ({
  nativeEvent: { layout: { x: 0, y: 0, width: 402, height } },
});

describe('MapSheet', () => {
  it('pads its content up to the bottom of the area when laid out taller than it (TR-59)', () => {
    render(
      <MapSheet halfHeight={386} bottomInset={98} top={<Text>Fri, Nov 13</Text>} testID="sheet">
        <Text>List</Text>
      </MapSheet>,
    );
    // On device: a 686 pt area, the 15 pt grabber row, and content laid out 766 pt tall.
    fireEvent(screen.getByTestId('sheet-area'), 'layout', layout(686));
    fireEvent(screen.getByTestId('sheet'), 'layout', layout(766));
    expect(screen.getByTestId('sheet')).toHaveStyle({ paddingBottom: 95 });
  });

  it('adds nothing when the content fits', () => {
    render(
      <MapSheet halfHeight={386} bottomInset={98} top={<Text>Fri, Nov 13</Text>} testID="sheet">
        <Text>List</Text>
      </MapSheet>,
    );
    fireEvent(screen.getByTestId('sheet-area'), 'layout', layout(686));
    fireEvent(screen.getByTestId('sheet'), 'layout', layout(671));
    expect(screen.getByTestId('sheet')).toHaveStyle({ paddingBottom: 0 });
  });
});
