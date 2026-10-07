import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';

import OrganizeLayout from '../app/(tabs)/organize/_layout';
import ImportRoute from '../app/(tabs)/organize/import';
import OrganizeRoute from '../app/(tabs)/organize/index';
import { exitScenario, loadScenario } from '@/scenarios';
import { useActiveSource } from '@/services/data/active';
import { useImportStore } from '@/stores/import';
import { useTripStore } from '@/stores/trip';

// The native date picker: a button that reports the date it was given.
jest.mock('@react-native-community/datetimepicker', () => {
  const { Pressable, Text } = require('react-native');
  return {
    __esModule: true,
    default: ({ value, onChange, testID }: any) => (
      <Pressable testID={testID} onPress={() => onChange({ type: 'set' }, value)}>
        <Text>{value.toISOString()}</Text>
      </Pressable>
    ),
  };
});

jest.mock('@/services/supabase', () => ({
  supabase: { auth: require('@/features/auth/testing').fakeAuth },
}));

jest.mock('@/services/photos', () => ({
  findCoverPhoto: async () => null,
  trackPhotoDownload: async () => {},
}));

const mockGetDocument = jest.fn();
jest.mock('expo-document-picker', () => ({
  getDocumentAsync: (...args: unknown[]) => mockGetDocument(...args),
}));

const routes = {
  '(tabs)/organize/_layout': OrganizeLayout,
  '(tabs)/organize/index': OrganizeRoute,
  '(tabs)/organize/import': ImportRoute,
};

function open(scenario: string) {
  act(() => {
    loadScenario(scenario);
  });
  return renderRouter(routes, { initialUrl: '/organize' });
}

const source = () => useActiveSource.getState().source;

describe('booking import', () => {
  afterEach(() => {
    act(() => exitScenario());
    act(() => useImportStore.setState({ file: null, savedMessage: null }));
    mockGetDocument.mockReset();
  });

  it('opens the add sheet from the orange + with PDF, screenshot and passport options', async () => {
    open('vegas-wallet');
    fireEvent.press(await screen.findByTestId('organize-add'));
    expect(await screen.findByText('Choose a PDF')).toBeOnTheScreen();
    expect(screen.getByText('Choose a screenshot')).toBeOnTheScreen();
    expect(screen.getByText('Add a passport or visa')).toBeOnTheScreen();
    expect(screen.getByText("Bookings are read by Google Gemini's free tier.")).toBeOnTheScreen();
  });

  it('imports a hotel PDF into the matching trip: card, pin, plan items and expense', async () => {
    mockGetDocument.mockResolvedValue({
      canceled: false,
      assets: [
        {
          uri: 'file:///tmp/sample-hotel.pdf',
          name: 'sample-hotel.pdf',
          mimeType: 'application/pdf',
        },
      ],
    });
    open('vegas-wallet');
    fireEvent.press(await screen.findByTestId('organize-add'));
    fireEvent.press(await screen.findByTestId('add-booking-pdf'));

    expect(await screen.findByText('Reading your booking')).toBeOnTheScreen();
    expect(await screen.findByText('Review booking', {}, { timeout: 3000 })).toBeOnTheScreen();
    expect(screen.getByTestId('review-hotel-name').props.value).toBe('The Silo Hotel');
    expect(screen.getByTestId('review-price-amount').props.value).toBe('63000');
    expect(screen.getByText('Adds to Cape Town')).toBeOnTheScreen();

    fireEvent.press(screen.getByTestId('import-save'));
    expect(
      await screen.findByText(
        'Saved to your wallet. Also added to Sat, Dec 19 on your plan and map.',
      ),
    ).toBeOnTheScreen();
    // Organize now shows Cape Town, with the new card.
    expect(useTripStore.getState().selectedTripId).toBe('trip-cape-town');
    expect(await screen.findByText('The Silo Hotel')).toBeOnTheScreen();

    const data = (await source().getTripData('trip-cape-town'))!;
    expect(data.bookings).toEqual([expect.objectContaining({ type: 'hotel' })]);
    expect(data.places).toEqual([
      expect.objectContaining({ name: 'The Silo Hotel', lat: -33.9083, lng: 18.4217 }),
    ]);
    expect(data.items.map((i) => [i.day, i.startTime, i.title])).toEqual([
      ['2026-12-19', '14:00', 'Check in at The Silo Hotel'],
      ['2027-01-06', '11:00', 'Check out of The Silo Hotel'],
    ]);
    expect(data.expenses).toEqual([
      expect.objectContaining({ amountMinor: 6300000, currency: 'ZAR', category: 'Hotels' }),
    ]);
  });

  it('offers to create a trip when none matches, and saves the booking in it', async () => {
    open('import-review-new-trip');
    expect(await screen.findByText('Review booking', {}, { timeout: 3000 })).toBeOnTheScreen();
    expect(await screen.findByText('Create Lisbon trip, Feb 12 – Feb 16, 2027?')).toBeOnTheScreen();
    expect(screen.getByText('Create trip and save')).toBeOnTheScreen();

    fireEvent.press(screen.getByTestId('import-save'));
    expect(
      await screen.findByText(
        'Created your Lisbon trip and saved the booking. Also added to Fri, Feb 12 on your plan and map.',
      ),
    ).toBeOnTheScreen();
    const lisbon = (await source().listTrips()).find((t) => t.city === 'Lisbon');
    expect(lisbon).toMatchObject({
      startDate: '2027-02-12',
      endDate: '2027-02-16',
      timezone: 'Europe/Lisbon',
    });
    const data = (await source().getTripData(lisbon!.id))!;
    expect(data.bookings).toEqual([
      expect.objectContaining({
        type: 'hotel',
        data: expect.objectContaining({ name: 'Memmo Alfama' }),
      }),
    ]);
    expect(useTripStore.getState().selectedTripId).toBe(lisbon!.id);
  });

  it('shows the review of a round-trip flight with every leg and the doubtful seat flagged', async () => {
    open('import-review-flight');
    expect(await screen.findByText('Review booking', {}, { timeout: 3000 })).toBeOnTheScreen();
    expect(screen.getByText('Flight 1')).toBeOnTheScreen();
    expect(screen.getByText('Flight 2')).toBeOnTheScreen();
    expect(screen.getByTestId('review-legs-1-flightNumber').props.value).toBe('DL 9202');
    expect(screen.getByTestId('review-legs-1-seat').props.accessibilityHint).toBe(
      "Check this one: it wasn't clear on the booking.",
    );
    expect(screen.getByText('Adds to Cape Town')).toBeOnTheScreen();
  });

  it('flags a field left empty and lets the type change', async () => {
    open('import-review-restaurant');
    expect(await screen.findByText('Review booking', {}, { timeout: 3000 })).toBeOnTheScreen();
    expect(screen.getByTestId('review-venue-name').props.value).toBe('La Colombe');

    fireEvent.changeText(screen.getByTestId('review-venue-name'), '');
    fireEvent.press(screen.getByTestId('import-save'));
    expect(await screen.findByText('Fix the highlighted fields to save.')).toBeOnTheScreen();
    expect(screen.getByText('Fill this in.')).toBeOnTheScreen();

    fireEvent.changeText(screen.getByTestId('review-venue-name'), 'La Colombe');
    fireEvent.press(screen.getByTestId('import-type-ticket'));
    expect(screen.getByTestId('review-event').props.value).toBe('La Colombe');
    expect(screen.getByTestId('review-section')).toBeOnTheScreen();
  });

  it('saves a reservation as a ticket card with a dinner on the plan', async () => {
    open('import-review-restaurant');
    expect(await screen.findByText('Review booking', {}, { timeout: 3000 })).toBeOnTheScreen();
    fireEvent.press(screen.getByTestId('import-save'));
    await waitFor(() => expect(useImportStore.getState().savedMessage).not.toBeNull());
    const data = (await source().getTripData('trip-cape-town'))!;
    expect(data.bookings).toEqual([
      expect.objectContaining({
        type: 'ticket',
        data: expect.objectContaining({ event: 'La Colombe' }),
      }),
    ]);
    expect(data.items.map((i) => i.title)).toEqual(['Dinner at La Colombe']);
    expect(data.expenses).toEqual([]);
  });

  it('says plainly when booking import is not set up yet', async () => {
    open('import-not-configured');
    expect(
      await screen.findByText(
        "Booking import isn't set up yet. Add the booking by hand for now.",
        {},
        { timeout: 3000 },
      ),
    ).toBeOnTheScreen();
    expect(screen.getByText("Couldn't read this booking")).toBeOnTheScreen();
  });
});
