import { renderRouter, screen } from 'expo-router/testing-library';

import TabLayout from '../app/(tabs)/_layout';
import RootLayout from '../app/_layout';
import Index from '../app/index';
import GalleryScreen from '../app/dev/gallery';
import DiscoverScreen from '../app/(tabs)/discover/index';
import OrganizeScreen from '../app/(tabs)/organize/index';
import PlanScreen from '../app/(tabs)/plan/index';
import TripsScreen from '../app/(tabs)/trips/index';

describe('tab layout', () => {
  it('opens on the Trips tab', async () => {
    const router = renderRouter(
      {
        _layout: RootLayout,
        index: Index,
        '(tabs)/_layout': TabLayout,
        '(tabs)/trips/index': TripsScreen,
        '(tabs)/plan/index': PlanScreen,
        '(tabs)/organize/index': OrganizeScreen,
        '(tabs)/discover/index': DiscoverScreen,
        'dev/gallery': GalleryScreen,
      },
      { initialUrl: '/' },
    );

    expect(await screen.findByRole('header', { name: 'Trips' })).toBeOnTheScreen();
    expect(router.getPathname()).toBe('/trips');
  });
});
