import { render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Sheet } from './Sheet';
import { Text } from './Text';

describe('Sheet', () => {
  it('renders its title and content', () => {
    render(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 390, height: 844 },
          insets: { top: 47, left: 0, right: 0, bottom: 34 },
        }}
      >
        <Sheet open onClose={() => {}} title="Fri, Nov 14">
          <Text>Brunch at Mon Ami Gabi</Text>
        </Sheet>
      </SafeAreaProvider>,
    );
    expect(screen.getByRole('header', { name: 'Fri, Nov 14' })).toBeOnTheScreen();
    expect(screen.getByText('Brunch at Mon Ami Gabi')).toBeOnTheScreen();
  });
});
