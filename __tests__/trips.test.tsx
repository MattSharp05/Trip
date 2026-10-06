import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';

import TabLayout from '../app/(tabs)/_layout';
import DiscoverScreen from '../app/(tabs)/discover/index';
import OrganizeScreen from '../app/(tabs)/organize/index';
import PlanScreen from '../app/(tabs)/plan/index';
import TripsLayout from '../app/(tabs)/trips/_layout';
import TripsScreen from '../app/(tabs)/trips/index';
import NewTripScreen from '../app/(tabs)/trips/new';
import ScenarioRoute from '../app/scenario/[name]';
import RootLayout from '../app/_layout';
import Index from '../app/index';
import { resetFakeAuth } from '@/features/auth/testing';
import { exitScenario } from '@/scenarios';
import { useTripStore } from '@/stores/trip';

jest.mock('@/services/supabase', () => ({
  supabase: { auth: require('@/features/auth/testing').fakeAuth },
}));

const lisbon = {
  id: 'R5400890',
  name: 'Lisbon',
  region: null,
  country: 'Portugal',
  countryCode: 'PT',
  lat: 38.7077507,
  lng: -9.1365919,
};
const mockSearchPlaces = jest.fn(async (_query: string) => [lisbon]);
jest.mock('@/services/places', () => ({
  searchPlaces: (query: string) => mockSearchPlaces(query),
}));

const mockTrack = jest.fn(async (_location: string) => {});
jest.mock('@/services/photos', () => ({
  findCoverPhoto: async () => ({
    url: 'https://images.unsplash.com/photo-lisbon',
    photographer: 'Ana Lisboa',
    photographerUrl: 'https://unsplash.com/@ana',
    photoUrl: 'https://unsplash.com/photos/abc',
    downloadLocation: 'https://api.unsplash.com/photos/abc/download',
  }),
  trackPhotoDownload: (location: string) => mockTrack(location),
}));

// The native picker: a button per row that moves the date, so tests can set dates.
jest.mock('@react-native-community/datetimepicker', () => {
  const { Pressable, Text } = require('react-native');
  return {
    __esModule: true,
    default: ({ value, onChange, testID }: any) => (
      <Pressable
        testID={testID}
        onPress={(e: any) => onChange({ type: 'set' }, new Date(e?.nativeEvent?.date ?? value))}
      >
        <Text>{value.toDateString()}</Text>
      </Pressable>
    ),
  };
});

beforeEach(() => resetFakeAuth(null));
afterEach(() => act(() => exitScenario()));

const routes = {
  _layout: RootLayout,
  index: Index,
  '(tabs)/_layout': TabLayout,
  '(tabs)/trips/_layout': TripsLayout,
  '(tabs)/trips/index': TripsScreen,
  '(tabs)/trips/new': NewTripScreen,
  '(tabs)/plan/index': PlanScreen,
  '(tabs)/organize/index': OrganizeScreen,
  '(tabs)/discover/index': DiscoverScreen,
  'scenario/[name]': ScenarioRoute,
};

const cardNames = () =>
  screen
    .getAllByTestId(/^trip-card-/)
    .map((card) => card.props.accessibilityLabel)
    .filter(Boolean);

describe('Trips tab', () => {
  it('shows My Trips with Upcoming, Past and All', async () => {
    renderRouter(routes, { initialUrl: '/scenario/vegas-trips' });
    expect(await screen.findByRole('header', { name: 'My Trips' })).toBeOnTheScreen();
    await screen.findByTestId('trip-card-trip-vegas');

    // Today is Fri Nov 13 2026: New York (Oct 16–20) is over.
    expect(cardNames()).toEqual([
      'Las Vegas, Nov 12 – Nov 16, 2026',
      'Cape Town, Dec 18 – Jan 6, 2027',
      'Tokyo, Mar 20 – Mar 29, 2027',
    ]);
    fireEvent.press(screen.getByRole('tab', { name: 'Past' }));
    expect(cardNames()).toEqual(['New York, Oct 16 – Oct 20, 2026']);
    fireEvent.press(screen.getByRole('tab', { name: 'All' }));
    expect(cardNames()).toEqual([
      'New York, Oct 16 – Oct 20, 2026',
      'Las Vegas, Nov 12 – Nov 16, 2026',
      'Cape Town, Dec 18 – Jan 6, 2027',
      'Tokyo, Mar 20 – Mar 29, 2027',
    ]);
    // Every sample trip has a cover photo.
    for (const id of ['new-york', 'vegas', 'cape-town', 'tokyo']) {
      expect(screen.getByTestId(`trip-card-trip-${id}-photo`)).toBeOnTheScreen();
    }
  });

  it('tapping a card selects the trip and opens Plan', async () => {
    const router = renderRouter(routes, { initialUrl: '/scenario/vegas-trips' });
    act(() => useTripStore.getState().selectTrip(null));
    fireEvent.press(await screen.findByRole('button', { name: 'Cape Town, Dec 18 – Jan 6, 2027' }));
    await act(async () => {});
    expect(useTripStore.getState().selectedTripId).toBe('trip-cape-town');
    expect(router.getPathname()).toBe('/plan');
  });

  it('shows the empty state for a new account', async () => {
    renderRouter(routes, { initialUrl: '/scenario/empty-account' });
    expect(await screen.findByText('Plan your first trip')).toBeOnTheScreen();
    expect(screen.getByTestId('trips-empty-create')).toBeOnTheScreen();
    expect(screen.queryByRole('tab', { name: 'Upcoming' })).toBeNull();
  });

  it('creates a trip: search, pick, dates, save', async () => {
    const router = renderRouter(routes, { initialUrl: '/scenario/vegas-trips' });
    fireEvent.press(await screen.findByTestId('trips-create'));
    await act(async () => {});
    expect(router.getPathname()).toBe('/trips/new');

    fireEvent.changeText(screen.getByTestId('destination-input'), 'Lisb');
    fireEvent.press(await screen.findByTestId('destination-R5400890', {}, { timeout: 2000 }));
    expect(mockSearchPlaces).toHaveBeenCalledWith('Lisb');
    expect(screen.getByTestId('destination-picked')).toBeOnTheScreen();

    fireEvent.press(screen.getByTestId('create-trip-start'), {
      nativeEvent: { date: new Date(2027, 3, 3).getTime() },
    });
    fireEvent.press(screen.getByTestId('create-trip-end'), {
      nativeEvent: { date: new Date(2027, 3, 8).getTime() },
    });
    fireEvent.press(screen.getByTestId('create-trip-save'));

    await waitFor(() => expect(router.getPathname()).toBe('/trips'));
    expect(
      await screen.findByRole('button', { name: 'Lisbon, Apr 3 – Apr 8, 2027' }),
    ).toBeOnTheScreen();
    expect(screen.getByText('Ana Lisboa')).toBeOnTheScreen();
    expect(mockTrack).toHaveBeenCalledWith('https://api.unsplash.com/photos/abc/download');
    expect(useTripStore.getState().selectedTripId).toMatch(/^trip-/);
    expect(useTripStore.getState().selectedTripId).not.toBe('trip-vegas');
  });
});
