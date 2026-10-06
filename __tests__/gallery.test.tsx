import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';

import TabLayout from '../app/(tabs)/_layout';
import DiscoverScreen from '../app/(tabs)/discover/index';
import OrganizeScreen from '../app/(tabs)/organize/index';
import PlanScreen from '../app/(tabs)/plan/index';
import TripsScreen from '../app/(tabs)/trips/index';
import GalleryScreen from '../app/dev/gallery';
import RootLayout from '../app/_layout';
import Index from '../app/index';

const routes = {
  _layout: RootLayout,
  index: Index,
  '(tabs)/_layout': TabLayout,
  '(tabs)/trips/index': TripsScreen,
  '(tabs)/plan/index': PlanScreen,
  '(tabs)/organize/index': OrganizeScreen,
  '(tabs)/discover/index': DiscoverScreen,
  'dev/gallery': GalleryScreen,
};

describe('design gallery', () => {
  it('opens from the Trips placeholder', async () => {
    const router = renderRouter(routes, { initialUrl: '/' });
    fireEvent.press(await screen.findByRole('button', { name: 'Design gallery' }));
    expect(router.getPathname()).toBe('/dev/gallery');
    await act(async () => {});
  });

  it('shows every component in its states', async () => {
    renderRouter(routes, { initialUrl: '/dev/gallery' });

    expect(await screen.findByText('My Trips')).toBeOnTheScreen();
    await act(async () => {}); // let the Skeletons read the Reduce Motion setting
    expect(screen.getByRole('tab', { name: 'Upcoming' })).toBeSelected();
    expect(screen.getByRole('button', { name: 'All' })).toBeSelected();
    expect(screen.getByRole('button', { name: 'Hotels' })).not.toBeSelected();
    expect(screen.getByRole('button', { name: 'View Boarding Pass' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Saving' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Add trip' })).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: 'New York, Oct 16 – Oct 20, 2026' }),
    ).toBeOnTheScreen();
    expect(screen.getByText('Cape Town')).toBeOnTheScreen();
    expect(screen.getByText('Flight to New York')).toBeOnTheScreen();
    expect(screen.getAllByLabelText('Loading')).toHaveLength(3);
    expect(screen.getByRole('header', { name: 'Fri, Nov 14' })).toBeOnTheScreen();
  });

  it('switches chips and segments, and undoes from the toast', async () => {
    renderRouter(routes, { initialUrl: '/dev/gallery' });

    fireEvent.press(await screen.findByRole('button', { name: 'Hotels' }));
    await act(async () => {});
    expect(screen.getByRole('button', { name: 'Hotels' })).toBeSelected();
    expect(screen.getByRole('button', { name: 'All' })).not.toBeSelected();

    fireEvent.press(screen.getByRole('tab', { name: 'Past' }));
    expect(screen.getByRole('tab', { name: 'Past' })).toBeSelected();

    fireEvent.press(screen.getByRole('button', { name: 'Show toast' }));
    expect(screen.getByText('Added to Day 3 at 2:00 PM')).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: 'Undo' }));
    expect(screen.getByText('Undone')).toBeOnTheScreen();
    await act(async () => {});
    expect(screen.queryByText('Added to Day 3 at 2:00 PM')).toBeNull();
  });

  it('is hidden when dev tools are off', async () => {
    process.env.EXPO_PUBLIC_SCENARIOS = 'off';
    try {
      const router = renderRouter(routes, { initialUrl: '/dev/gallery' });
      expect(await screen.findByRole('header', { name: 'Trips' })).toBeOnTheScreen();
      expect(router.getPathname()).toBe('/trips');
      expect(screen.queryByRole('button', { name: 'Design gallery' })).toBeNull();
    } finally {
      delete process.env.EXPO_PUBLIC_SCENARIOS;
    }
  });
});
