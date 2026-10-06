import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import * as Brightness from 'expo-brightness';
import { router } from 'expo-router';
import * as Calendar from 'expo-calendar/legacy';
import * as ImagePicker from 'expo-image-picker';

import OrganizeLayout from '../app/(tabs)/organize/_layout';
import FlightRoute from '../app/(tabs)/organize/flight/[id]';
import OrganizeRoute from '../app/(tabs)/organize/index';
import WalletItemRoute from '../app/(tabs)/organize/item/[id]';
import BoardingPassRoute from '../app/(tabs)/organize/pass/[id]';
import { exitScenario, loadScenario } from '@/scenarios';

jest.mock('expo-brightness', () => ({
  getBrightnessAsync: jest.fn(async () => 0.4),
  setBrightnessAsync: jest.fn(async () => {}),
}));
jest.mock('expo-calendar/legacy', () => ({
  createEventInCalendarAsync: jest.fn(async () => ({ action: 'saved', id: 'e1' })),
}));
jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: jest.fn(async () => ({
    canceled: false,
    assets: [{ uri: 'file:///pass.png', width: 1170, height: 2532 }],
  })),
}));
jest.mock('expo-sharing', () => ({ shareAsync: jest.fn(async () => {}) }));
jest.mock('expo-asset', () => ({
  Asset: { loadAsync: jest.fn(async () => [{ localUri: 'file:///sample.png', uri: '' }]) },
}));

// Organize → Budget reads preferences, which import the Supabase client.
jest.mock('@/services/supabase', () => ({
  supabase: { auth: require('@/features/auth/testing').fakeAuth },
}));

const routes = {
  '(tabs)/organize/_layout': OrganizeLayout,
  '(tabs)/organize/index': OrganizeRoute,
  '(tabs)/organize/item/[id]': WalletItemRoute,
  '(tabs)/organize/flight/[id]': FlightRoute,
  '(tabs)/organize/pass/[id]': BoardingPassRoute,
};

async function openFlight(scenario: string) {
  act(() => {
    loadScenario(scenario);
  });
  const router = renderRouter(routes, { initialUrl: '/organize' });
  fireEvent.press(await screen.findByTestId('wallet-card-booking-flight-out'));
  await screen.findByTestId('flight-facts');
  return router;
}

async function openPass(scenario: string) {
  const router = await openFlight(scenario);
  fireEvent.press(screen.getByTestId('flight-view-pass'));
  await screen.findByTestId('boarding-pass');
  return router;
}

describe('Flight details', () => {
  afterEach(() => act(() => exitScenario()));

  it('opens AA 2410 from the wallet with local times, gate and seat', async () => {
    const router = await openFlight('vegas-wallet');
    expect(router.getPathname()).toBe('/organize/flight/booking-flight-out');
    expect(screen.getByText('American Airlines')).toBeOnTheScreen();
    expect(screen.getByText('AA 2410')).toBeOnTheScreen();
    expect(screen.getByText('TPA')).toBeOnTheScreen();
    expect(screen.getByText('9:05 AM')).toBeOnTheScreen();
    expect(screen.getByText('LAS')).toBeOnTheScreen();
    expect(screen.getByText('11:02 AM')).toBeOnTheScreen();
    expect(screen.getByText('E75')).toBeOnTheScreen();
    expect(screen.getByText('14A')).toBeOnTheScreen();
    // No original file on this booking: the row is hidden.
    expect(screen.queryByTestId('flight-original')).toBeNull();
  });

  it('adds the flight to the calendar through the system sheet', async () => {
    await openFlight('vegas-wallet');
    fireEvent.press(screen.getByTestId('flight-calendar'));
    expect(await screen.findByText('Added to your calendar')).toBeOnTheScreen();
    expect(Calendar.createEventInCalendarAsync).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'AA 2410 to Las Vegas' }),
    );
  });

  it('shows the original booking row when the booking has one', async () => {
    await openFlight('vegas-boarding-pass');
    expect(screen.getByTestId('flight-original')).toBeOnTheScreen();
  });
});

describe('Boarding pass', () => {
  afterEach(() => act(() => exitScenario()));
  beforeEach(() => jest.clearAllMocks());

  it('shows the code cropped from the pass image', async () => {
    await openPass('vegas-boarding-pass');
    const code = screen.getByTestId('pass-code');
    fireEvent(code, 'layout', { nativeEvent: { layout: { width: 300, height: 0 } } });
    expect(await screen.findByTestId('pass-code-image')).toBeOnTheScreen();
    expect(screen.queryByTestId('pass-add-prompt')).toBeNull();
    expect(screen.getByText('Matthew S.')).toBeOnTheScreen();
    expect(screen.getByText('8:25 AM')).toBeOnTheScreen();
  });

  it('asks for the pass when there is no image, then opens the code area editor', async () => {
    await openPass('vegas-wallet');
    expect(screen.getByText('Add your boarding pass to show its code')).toBeOnTheScreen();
    expect(screen.queryByTestId('pass-code')).toBeNull();
    fireEvent.press(screen.getByTestId('pass-add'));
    expect(await screen.findByTestId('crop-editor')).toBeOnTheScreen();
    expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalled();
    fireEvent.press(screen.getByTestId('crop-save'));
    expect(await screen.findByTestId('pass-code')).toBeOnTheScreen();
  });

  it('adjusts the code area and keeps the pass', async () => {
    await openPass('vegas-boarding-pass');
    fireEvent.press(screen.getByTestId('pass-adjust'));
    expect(await screen.findByTestId('crop-editor')).toBeOnTheScreen();
    fireEvent.press(screen.getByTestId('crop-cancel'));
    expect(await screen.findByTestId('pass-code')).toBeOnTheScreen();
  });

  it('turns brightness up while open and restores it after leaving', async () => {
    const rendered = await openPass('vegas-boarding-pass');
    await waitFor(() => expect(Brightness.setBrightnessAsync).toHaveBeenCalledWith(1));
    act(() => router.back());
    await waitFor(() => expect(Brightness.setBrightnessAsync).toHaveBeenLastCalledWith(0.4));
    expect(rendered.getPathname()).toBe('/organize/flight/booking-flight-out');
  });
});
