import { act, fireEvent, renderRouter, screen, waitFor, within } from 'expo-router/testing-library';

import OrganizeLayout from '../app/(tabs)/organize/_layout';
import OrganizeRoute from '../app/(tabs)/organize/index';
import HotelRoute from '../app/(tabs)/organize/hotel/[id]';
import WalletItemRoute from '../app/(tabs)/organize/item/[id]';
import { exitScenario, loadScenario } from '@/scenarios';
import { useTripStore } from '@/stores/trip';

jest.mock('@/services/supabase', () => ({
  supabase: { auth: require('@/features/auth/testing').fakeAuth },
}));

// The hotel screen looks for a photo; no Unsplash key yet, so the function finds none.
jest.mock('@/services/photos', () => ({ findCoverPhoto: async () => null }));

const routes = {
  '(tabs)/organize/_layout': OrganizeLayout,
  '(tabs)/organize/index': OrganizeRoute,
  '(tabs)/organize/item/[id]': WalletItemRoute,
  '(tabs)/organize/hotel/[id]': HotelRoute,
};

const VEGAS_ORDER = [
  'wallet-card-booking-flight-out',
  'wallet-card-booking-car',
  'wallet-card-booking-hotel',
  'wallet-card-booking-ufc',
  'wallet-card-booking-flight-home',
  'wallet-card-document-passport',
];

async function openWallet(scenario = 'vegas-wallet') {
  act(() => {
    loadScenario(scenario);
  });
  const router = renderRouter(routes, { initialUrl: '/organize' });
  await screen.findByTestId('wallet-card-booking-flight-out');
  return router;
}

const cardIds = () =>
  within(screen.getByTestId('wallet-list'))
    .queryAllByTestId(/^wallet-card-/)
    .map((el) => el.props.testID as string);

describe('Organize → Wallet', () => {
  afterEach(() => act(() => exitScenario()));

  it('shows the six vegas-wallet items in date order, documents last', async () => {
    await openWallet();
    expect(screen.getByText('Organize')).toBeOnTheScreen();
    expect(cardIds()).toEqual(VEGAS_ORDER);
    expect(screen.getByText('Flight to Las Vegas')).toBeOnTheScreen();
    expect(screen.getByText('AA 2410 · TPA → LAS')).toBeOnTheScreen();
    expect(screen.getByText('Thu, Nov 12, 9:05 AM')).toBeOnTheScreen();
    expect(screen.getByText('Nov 12 – Nov 16 · 4 nights')).toBeOnTheScreen();
    expect(screen.getByText('Confirmation 837282')).toBeOnTheScreen();
    expect(screen.getByText('Hertz rental car')).toBeOnTheScreen();
    expect(screen.getByText('Hertz, Rent-A-Car Center')).toBeOnTheScreen();
    expect(screen.getByText('T-Mobile Arena')).toBeOnTheScreen();
    expect(screen.getByText('Expires Jun 2034')).toBeOnTheScreen();
    // Brand code badges, no logos.
    expect(screen.getAllByText('AA')).toHaveLength(2);
    expect(screen.getByText('H')).toBeOnTheScreen();
  });

  it('filters with each chip, with an empty state', async () => {
    await openWallet();
    const pick = (value: string) => fireEvent.press(screen.getByTestId(`wallet-filter-${value}`));
    pick('flight');
    expect(cardIds()).toEqual([
      'wallet-card-booking-flight-out',
      'wallet-card-booking-flight-home',
    ]);
    pick('hotel');
    expect(cardIds()).toEqual(['wallet-card-booking-hotel']);
    pick('car');
    expect(cardIds()).toEqual(['wallet-card-booking-car']);
    pick('ticket');
    expect(cardIds()).toEqual(['wallet-card-booking-ufc']);
    pick('document');
    expect(cardIds()).toEqual(['wallet-card-document-passport']);
    pick('all');
    expect(cardIds()).toEqual(VEGAS_ORDER);
  });

  it('shows documents on every trip, and a per-filter empty state', async () => {
    await openWallet();
    act(() => useTripStore.getState().selectTrip('trip-tokyo'));
    await waitFor(() => expect(cardIds()).toEqual(['wallet-card-document-passport']));
    fireEvent.press(screen.getByTestId('wallet-filter-flight'));
    expect(screen.getByText('No flights on this trip')).toBeOnTheScreen();
  });

  it('hides the + button until import exists (TR-25)', async () => {
    await openWallet();
    expect(screen.queryByLabelText(/add/i)).toBeNull();
  });

  it("opens a card's own detail screen", async () => {
    const router = await openWallet();
    fireEvent.press(screen.getByTestId('wallet-card-booking-hotel'));
    await act(async () => {});
    expect(router.getPathname()).toBe('/organize/hotel/booking-hotel');
    expect(await screen.findByText('837282')).toBeOnTheScreen();
  });

  it('opens on Budget when the scenario asks for it', async () => {
    act(() => {
      loadScenario('vegas-budget-eur');
    });
    renderRouter(routes, { initialUrl: '/organize' });
    expect(await screen.findByTestId('budget-slot')).toBeOnTheScreen();
    expect(screen.queryByTestId('wallet-list')).toBeNull();
    fireEvent.press(screen.getByText('Wallet'));
    expect(await screen.findByTestId('wallet-card-booking-hotel')).toBeOnTheScreen();
  });
});
