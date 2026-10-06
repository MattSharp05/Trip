import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { Linking } from 'react-native';

import OrganizeLayout from '../app/(tabs)/organize/_layout';
import CarRoute from '../app/(tabs)/organize/car/[id]';
import HotelRoute from '../app/(tabs)/organize/hotel/[id]';
import OrganizeRoute from '../app/(tabs)/organize/index';
import TicketRoute from '../app/(tabs)/organize/ticket/[id]';
import { queryClient } from '@/services/data';
import { exitScenario, loadScenario } from '@/scenarios';

const mockFindCoverPhoto = jest.fn(async (_query: string) => null as unknown);
jest.mock('@/services/photos', () => ({
  findCoverPhoto: (query: string) => mockFindCoverPhoto(query),
}));

// Organize → Budget reads preferences, which import the Supabase client.
jest.mock('@/services/supabase', () => ({
  supabase: { auth: require('@/features/auth/testing').fakeAuth },
}));

const routes = {
  '(tabs)/organize/_layout': OrganizeLayout,
  '(tabs)/organize/index': OrganizeRoute,
  '(tabs)/organize/hotel/[id]': HotelRoute,
  '(tabs)/organize/car/[id]': CarRoute,
  '(tabs)/organize/ticket/[id]': TicketRoute,
};

let openURL: jest.SpyInstance;

async function openCard(card: string, ready: string) {
  act(() => {
    loadScenario('vegas-wallet');
  });
  const router = renderRouter(routes, { initialUrl: '/organize' });
  fireEvent.press(await screen.findByTestId(`wallet-card-${card}`));
  await screen.findByTestId(ready);
  return router;
}

beforeEach(() => {
  openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
  mockFindCoverPhoto.mockClear();
  queryClient.removeQueries({ queryKey: ['photos'] });
});
afterEach(() => {
  openURL.mockRestore();
  act(() => exitScenario());
});

describe('Hotel details', () => {
  it('opens The Cosmopolitan with its stay, check-in and confirmation', async () => {
    const router = await openCard('booking-hotel', 'hotel-facts');
    expect(router.getPathname()).toBe('/organize/hotel/booking-hotel');
    expect(screen.getByText('The Cosmopolitan')).toBeOnTheScreen();
    expect(screen.getByText('Nov 12 – Nov 16 · 4 nights')).toBeOnTheScreen();
    expect(screen.getByText('3708 Las Vegas Blvd S, Las Vegas, NV 89109')).toBeOnTheScreen();
    expect(screen.getByText('Nov 12, 3:00 PM')).toBeOnTheScreen();
    expect(screen.getByText('Nov 16, 11:00 AM')).toBeOnTheScreen();
    expect(screen.getByText('837282')).toBeOnTheScreen();
    expect(screen.getByText('Terrace Studio')).toBeOnTheScreen();
  });

  it('shows Directions, Call and Website, and no Email the booking lacks', async () => {
    await openCard('booking-hotel', 'hotel-facts');
    expect(screen.getByTestId('action-directions')).toBeOnTheScreen();
    expect(screen.getByTestId('action-call')).toBeOnTheScreen();
    expect(screen.getByTestId('action-website')).toBeOnTheScreen();
    expect(screen.queryByTestId('action-email')).toBeNull();
    expect(screen.queryByText('Email')).toBeNull();
    // No original file on this booking.
    expect(screen.queryByTestId('booking-original')).toBeNull();
  });

  it('opens Apple Maps, the phone and the website', async () => {
    await openCard('booking-hotel', 'hotel-facts');
    fireEvent.press(screen.getByTestId('action-directions'));
    fireEvent.press(screen.getByTestId('action-call'));
    fireEvent.press(screen.getByTestId('action-website'));
    await waitFor(() => expect(openURL).toHaveBeenCalledTimes(3));
    expect(openURL.mock.calls.map(([url]) => url)).toEqual([
      'http://maps.apple.com/?daddr=3708%20Las%20Vegas%20Blvd%20S%2C%20Las%20Vegas%2C%20NV%2089109',
      'tel:+17026987000',
      'https://www.cosmopolitanlasvegas.com',
    ]);
  });

  it('says so when a link cannot open', async () => {
    openURL.mockRejectedValueOnce(new Error('no handler'));
    await openCard('booking-hotel', 'hotel-facts');
    fireEvent.press(screen.getByTestId('action-call'));
    expect(await screen.findByText("Couldn't open that on this phone")).toBeOnTheScreen();
  });

  it('shows the placeholder while there is no photo (no Unsplash key yet)', async () => {
    await openCard('booking-hotel', 'hotel-facts');
    await waitFor(() => expect(mockFindCoverPhoto).toHaveBeenCalledWith('The Cosmopolitan hotel'));
    expect(screen.getByTestId('hotel-photo-placeholder')).toBeOnTheScreen();
    expect(screen.queryByTestId('hotel-photo-credit')).toBeNull();
  });

  it('shows an Unsplash photo with its credit once the function finds one', async () => {
    mockFindCoverPhoto.mockResolvedValueOnce({
      url: 'https://images.unsplash.com/photo-cosmo',
      photographer: 'Ana Vegas',
      photographerUrl: 'https://unsplash.com/@ana',
      photoUrl: 'https://unsplash.com/photos/cosmo',
      downloadLocation: 'https://api.unsplash.com/photos/cosmo/download',
    });
    await openCard('booking-hotel', 'hotel-facts');
    expect(await screen.findByTestId('hotel-photo')).toBeOnTheScreen();
    expect(screen.getByTestId('hotel-photo-credit')).toHaveTextContent(
      'Photo by Ana Vegas on Unsplash',
    );
  });
});

describe('Rental car details', () => {
  it('opens Hertz with pickup and return, confirmation and car class', async () => {
    const router = await openCard('booking-car', 'car-facts');
    expect(router.getPathname()).toBe('/organize/car/booking-car');
    expect(screen.getByText('Hertz rental car')).toBeOnTheScreen();
    expect(screen.getByText('Thu, Nov 12, 11:40 AM')).toBeOnTheScreen();
    expect(screen.getByText('Mon, Nov 16, 11:45 AM')).toBeOnTheScreen();
    expect(screen.getAllByText('Hertz, Rent-A-Car Center')).toHaveLength(2);
    expect(screen.getByText('H7742019')).toBeOnTheScreen();
    expect(screen.getByText('Car class')).toBeOnTheScreen();
  });

  it('gives directions to the pickup', async () => {
    await openCard('booking-car', 'car-facts');
    fireEvent.press(screen.getByTestId('booking-directions'));
    await waitFor(() =>
      expect(openURL).toHaveBeenCalledWith(
        'http://maps.apple.com/?daddr=7135%20Gilespie%20St%2C%20Las%20Vegas%2C%20NV',
      ),
    );
  });
});

describe('Ticket details', () => {
  it('opens UFC 310 with the venue, date, seats and confirmation', async () => {
    const router = await openCard('booking-ufc', 'ticket-facts');
    expect(router.getPathname()).toBe('/organize/ticket/booking-ufc');
    expect(screen.getByText('UFC 310')).toBeOnTheScreen();
    expect(screen.getByText('T-Mobile Arena')).toBeOnTheScreen();
    expect(screen.getByText('Sun, Nov 15, 6:00 PM')).toBeOnTheScreen();
    expect(screen.getByText('12')).toBeOnTheScreen();
    expect(screen.getByText('F')).toBeOnTheScreen();
    expect(screen.getByText('7, 8')).toBeOnTheScreen();
    expect(screen.getByText('TM-31055802')).toBeOnTheScreen();
  });

  it('gives directions to the venue', async () => {
    await openCard('booking-ufc', 'ticket-facts');
    fireEvent.press(screen.getByTestId('booking-directions'));
    await waitFor(() =>
      expect(openURL).toHaveBeenCalledWith(
        'http://maps.apple.com/?daddr=3780%20Las%20Vegas%20Blvd%20S%2C%20Las%20Vegas%2C%20NV',
      ),
    );
  });
});
