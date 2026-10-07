import { act, fireEvent, renderRouter, screen, waitFor, within } from 'expo-router/testing-library';

import TabLayout from '../app/(tabs)/_layout';
import PlanScreen from '../app/(tabs)/plan/index';
import ScenarioRoute from '../app/scenario/[name]';
import RootLayout from '../app/_layout';
import { resetFakeAuth } from '@/features/auth/testing';
import { exitScenario } from '@/scenarios';
import { searchSpots } from '@/services/places';

jest.mock('@/services/supabase', () => ({
  supabase: { auth: require('@/features/auth/testing').fakeAuth },
}));

jest.mock('@/services/places', () => ({
  searchPlaces: jest.fn(async () => []),
  searchSpots: jest.fn(async () => [
    {
      id: 'N42',
      name: 'Eggslut',
      kind: 'food',
      area: 'Paradise',
      address: '3708 South Las Vegas Boulevard, Paradise',
      lat: 36.1092,
      lng: -115.1745,
    },
  ]),
}));

const routes = {
  _layout: RootLayout,
  '(tabs)/_layout': TabLayout,
  '(tabs)/trips/index': () => null,
  '(tabs)/plan/index': PlanScreen,
  '(tabs)/organize/index': () => null,
  '(tabs)/discover/index': () => null,
  'dev/gallery': () => null,
  'auth/index': () => null,
  'scenario/[name]': ScenarioRoute,
};

async function openBucket() {
  renderRouter(routes, { initialUrl: '/scenario/vegas-bucket' });
  await screen.findByTestId('bucket-list');
}

/** Each row's visible text, top to bottom (the last part is its Smart Add button). */
const rows = () =>
  within(screen.getByTestId('bucket-list'))
    .getAllByTestId(/^bucket-row-/)
    .map((row) =>
      within(row)
        .queryAllByText(/./)
        .map((t) => t.props.children)
        .join(' | '),
    );

/** Places drawn as outlined (Bucket List) pins. */
const outlined = () =>
  screen
    .queryAllByTestId(/^pin-place-/)
    .filter((pin) => within(pin).queryByTestId('pin-outline'))
    .map((pin) => pin.props.identifier as string);

beforeEach(() => resetFakeAuth(null));
afterEach(() => act(() => exitScenario()));

describe('Bucket List on vegas-bucket', () => {
  it('lists the saved places and the Discover event, with outlined pins', async () => {
    await openBucket();
    expect(rows()).toEqual([
      'Golden Tiki | 3939 Spring Mountain Rd · Bar | Saved from TikTok | Smart Add',
      'Fremont Street Experience | Fremont St · Landmark | From search | Smart Add',
      'Lotus of Siam | 620 E Flamingo Rd · Food | Saved from Instagram | Smart Add',
      'Pinball Hall of Fame | 4925 Las Vegas Blvd S · Attraction | From search | Smart Add',
      'Fred again.. | Wynn Las Vegas · Nightlife | From Discover · Sat, Nov 14, 8:00 PM | Smart Add',
    ]);
    expect(outlined()).toEqual([
      'place-golden-tiki',
      'place-fremont',
      'place-lotus-of-siam',
      'place-pinball',
      'place-xs',
    ]);

    // Outlined pins only while the Bucket List is open.
    fireEvent.press(screen.getByRole('tab', { name: 'Itinerary' }));
    expect(outlined()).toEqual([]);
  });

  it('searching "Eggslut" and adding it puts it in the list with its pin', async () => {
    await openBucket();
    fireEvent.press(screen.getByTestId('bucket-add'));
    fireEvent.changeText(screen.getByTestId('spot-input'), 'Eggslut');
    const result = await screen.findByTestId('spot-N42', {}, { timeout: 2000 });
    expect(searchSpots).toHaveBeenCalledWith('Eggslut', { lat: 36.1147, lng: -115.1728 });
    expect(within(result).getByText('Paradise · Food')).toBeTruthy();

    await act(async () => fireEvent.press(result));

    await waitFor(() =>
      expect(rows().at(-1)).toBe(
        'Eggslut | 3708 South Las Vegas Boulevard · Food | From search | Smart Add',
      ),
    );
    expect(screen.getByRole('tab', { name: 'Bucket List (6)' })).toBeSelected();
    expect(outlined()).toHaveLength(6);
    expect(screen.getByText('Added Eggslut to your Bucket List')).toBeTruthy();
  });

  it('touch and hold on the map drops a pin, which is named and saved', async () => {
    await openBucket();
    await act(async () =>
      fireEvent(screen.getByTestId('trip-map'), 'longPress', {
        nativeEvent: { coordinate: { latitude: 36.12, longitude: -115.17 } },
      }),
    );
    expect(screen.getByText('Name this place')).toBeTruthy();
    expect(screen.getByTestId('pin-save')).toBeDisabled();
    fireEvent.changeText(screen.getByTestId('pin-name-input'), 'Viewpoint by the Strip');
    await act(async () => fireEvent.press(screen.getByTestId('pin-save')));

    await waitFor(() =>
      expect(rows().at(-1)).toBe('Viewpoint by the Strip | Dropped pin | Smart Add'),
    );
    expect(outlined()).toHaveLength(6);
  });

  it('"Drop a pin" closes the search and says how', async () => {
    await openBucket();
    fireEvent.press(screen.getByTestId('bucket-add'));
    fireEvent.press(screen.getByTestId('bucket-drop-pin'));
    expect(screen.getByText('Touch and hold the map to drop a pin')).toBeTruthy();
  });

  it('a long press does nothing on the Itinerary', async () => {
    await openBucket();
    fireEvent.press(screen.getByRole('tab', { name: 'Itinerary' }));
    fireEvent(screen.getByTestId('trip-map'), 'longPress', {
      nativeEvent: { coordinate: { latitude: 36.12, longitude: -115.17 } },
    });
    expect(screen.queryByText('Name this place')).toBeNull();
  });

  it('deleting a row offers Undo, which brings it back', async () => {
    await openBucket();
    await act(async () =>
      fireEvent(screen.getByTestId('bucket-row-bucket-golden-tiki'), 'accessibilityAction', {
        nativeEvent: { actionName: 'delete' },
      }),
    );
    expect(await screen.findByText('Removed Golden Tiki')).toBeTruthy();
    expect(screen.queryByTestId('bucket-row-bucket-golden-tiki')).toBeNull();
    expect(screen.getByRole('tab', { name: 'Bucket List (4)' })).toBeTruthy();

    await act(async () => fireEvent.press(screen.getByText('Undo')));
    expect(await screen.findByTestId('bucket-row-bucket-golden-tiki')).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Bucket List (5)' })).toBeTruthy();
  });

  it('the swipe action deletes too', async () => {
    await openBucket();
    await act(async () => fireEvent.press(screen.getByTestId('bucket-delete-bucket-pinball')));
    expect(await screen.findByText('Removed Pinball Hall of Fame')).toBeTruthy();
  });
});
