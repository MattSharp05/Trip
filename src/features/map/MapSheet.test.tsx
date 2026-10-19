import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { MapSheet } from './MapSheet';

const layout = (height: number) => ({
  nativeEvent: { layout: { x: 0, y: 0, width: 402, height } },
});

describe('MapSheet', () => {
  it('sizes its content to the area under the grabber, however tall the library lays it out (TR-59)', () => {
    render(
      <MapSheet halfHeight={386} bottomInset={98} top={<Text>Fri, Nov 13</Text>} testID="sheet">
        <Text>List</Text>
      </MapSheet>,
    );
    // On device: a 686 pt area and the 15 pt grabber row; the content ran ~95 pt past the screen.
    fireEvent(screen.getByTestId('sheet-area'), 'layout', layout(686));
    expect(screen.getByTestId('sheet')).toHaveStyle({ height: 671 });
  });

  it('fills the sheet until the area has been measured', () => {
    render(
      <MapSheet halfHeight={386} bottomInset={98} top={<Text>Fri, Nov 13</Text>} testID="sheet">
        <Text>List</Text>
      </MapSheet>,
    );
    expect(screen.getByTestId('sheet')).toHaveStyle({ flex: 1 });
  });
});
