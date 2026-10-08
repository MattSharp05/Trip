import { act, fireEvent, renderRouter, screen, waitFor, within } from 'expo-router/testing-library';
import { StyleSheet } from 'react-native';

import TabLayout from '../app/(tabs)/_layout';
import DiscoverScreen from '../app/(tabs)/discover/index';
import ScenarioRoute from '../app/scenario/[name]';
import RootLayout from '../app/_layout';
import { resetFakeAuth } from '@/features/auth/testing';
import { exitScenario } from '@/scenarios';
import { useActiveSource } from '@/services/data';
import { useTripStore } from '@/stores/trip';
import { FLOATING_TAB_BAR } from '@/ui';

jest.mock('@/services/supabase', () => ({
  supabase: { auth: require('@/features/auth/testing').fakeAuth },
}));

const routes = {
  _layout: RootLayout,
  '(tabs)/_layout': TabLayout,
  '(tabs)/trips/index': () => null,
  '(tabs)/plan/index': () => null,
  '(tabs)/organize/index': () => null,
  '(tabs)/discover/index': DiscoverScreen,
  'dev/gallery': () => null,
  'auth/index': () => null,
  'scenario/[name]': ScenarioRoute,
};

const VEGAS_ROW = 'discover-trip-trip-vegas-events';
const CAPE_ROW = 'discover-trip-trip-cape-town-events';

/** The titles of a row's cards, left to right. */
const titles = (row: string) =>
  within(screen.getByTestId(row))
    .getAllByTestId(new RegExp(`^${row}-card-`))
    .filter((card) => !/-(add|saved|planned|tag)$/.test(card.props.testID))
    // The title: the first text after the "Sample" tag, if any.
    .map((card) => within(card).queryAllByText(/^(?!Sample$)./)[0]?.props.children);

/** Section headings in screen order. */
const sectionTitles = () =>
  within(screen.getByTestId('discover-all'))
    .getAllByRole('header')
    .map((h) => h.props.children);

async function open(scenario: string, ready: string) {
  renderRouter(routes, { initialUrl: `/scenario/${scenario}` });
  await screen.findByTestId(ready);
}

beforeEach(() => resetFakeAuth(null));
afterEach(() => act(() => exitScenario()));

describe('Discover across all upcoming trips (vegas-discover-all)', () => {
  it('shows one section per upcoming trip, soonest first, each with its own dates’ events', async () => {
    await open('vegas-discover-all', `${CAPE_ROW}-empty`);
    await screen.findByTestId(VEGAS_ROW);
    expect(screen.getByTestId('discover-trip-title')).toHaveTextContent('All upcoming trips');
    expect(sectionTitles()).toEqual([
      "While you're in Las Vegas · Nov 12 – 16",
      "Because you're going to Cape Town · Dec 18 – Jan 6",
    ]);
    expect(titles(VEGAS_ROW)).toEqual([
      'O by Cirque du Soleil',
      'Vegas Golden Knights vs. Seattle Kraken',
      'Late night at Zouk Nightclub',
      'Downtown Las Vegas Food Tour',
      'Fred again..',
      'Wine and Small Plates Walk',
      'UFC 310',
      'Comedy Cellar Late Show',
    ]);
    // No demo events in Cape Town until live listings are on (TR-33 QA round 2).
    expect(screen.getByTestId(`${CAPE_ROW}-empty`)).toHaveTextContent(
      'No events found on your dates.',
    );
    // Sections carry events only; curated places stay with a single trip.
    expect(screen.queryByText('Popular with travellers')).toBeNull();
    // Saved videos follow each trip's city: Las Vegas has some, Cape Town none (TR-34).
    expect(screen.getByTestId('discover-trip-trip-vegas-reels')).toBeTruthy();
    expect(screen.queryByTestId('discover-trip-trip-cape-town-reels')).toBeNull();
  });

  it('Networking shows the samples in Las Vegas and stays empty in Cape Town', async () => {
    await open('vegas-discover-all', `${CAPE_ROW}-empty`);
    fireEvent.press(screen.getByTestId('discover-filter-networking'));
    expect(titles(VEGAS_ROW)).toEqual([
      'Founders & Funders Breakfast',
      'Vegas Tech Mixer',
      'Women in Travel Meetup',
      'Downtown Startup Coffee',
    ]);
    expect(screen.getByTestId(`${CAPE_ROW}-empty`)).toHaveTextContent(
      'No networking events on your dates yet.',
    );
  });

  it('a saved video in the Las Vegas section saves to Las Vegas', async () => {
    await open('vegas-discover-all', `${CAPE_ROW}-empty`);
    fireEvent.press(screen.getByTestId('discover-trip-trip-vegas-reels-reel-2'));
    expect(await screen.findByText('High Roller')).toBeTruthy();
    await act(async () => fireEvent.press(screen.getByTestId('link-save')));
    await waitFor(() =>
      expect(screen.getByText('Added 4 places to your Bucket List')).toBeTruthy(),
    );
    const vegas = await useActiveSource.getState().source.getTripData('trip-vegas');
    expect(vegas?.bucketItems.at(-1)).toMatchObject({ tripId: 'trip-vegas', source: 'tiktok' });
  });

  it('+ in the Las Vegas section saves to Las Vegas’s Bucket List, not Cape Town’s', async () => {
    await open('vegas-discover-all', `${CAPE_ROW}-empty`);
    const source = useActiveSource.getState().source;
    const capeBefore = (await source.getTripData('trip-cape-town'))?.bucketItems.length;

    await act(async () =>
      fireEvent.press(screen.getByTestId(`${VEGAS_ROW}-card-fx:o-bellagio-1112-add`)),
    );
    await waitFor(() =>
      expect(screen.getByTestId(`${VEGAS_ROW}-card-fx:o-bellagio-1112-saved`)).toBeTruthy(),
    );
    expect(screen.getByText('Added O by Cirque du Soleil to your Bucket List')).toBeTruthy();

    const vegas = await source.getTripData('trip-vegas');
    expect(vegas?.bucketItems.at(-1)).toMatchObject({
      tripId: 'trip-vegas',
      title: 'O by Cirque du Soleil',
      source: 'discover',
      fixedDate: '2026-11-12',
    });
    expect((await source.getTripData('trip-cape-town'))?.bucketItems).toHaveLength(capeBefore ?? 0);
  });

  // TR-33 QA round 2: the last section ended under the floating tab bar and bounced back.
  it('pads the bottom so the last section scrolls clear of the tab bar', async () => {
    await open('vegas-discover-all', `${CAPE_ROW}-empty`);
    const content = StyleSheet.flatten(
      screen.getByTestId('discover-screen').props.contentContainerStyle,
    );
    expect(content.paddingBottom).toBeGreaterThanOrEqual(FLOATING_TAB_BAR);
  });

  it('applies the chips and search to every section', async () => {
    await open('vegas-discover-all', `${CAPE_ROW}-empty`);
    await screen.findByTestId(VEGAS_ROW);
    fireEvent.press(screen.getByTestId('discover-filter-sports'));
    expect(titles(VEGAS_ROW)).toEqual(['Vegas Golden Knights vs. Seattle Kraken', 'UFC 310']);
    expect(screen.getByTestId(`${CAPE_ROW}-empty`)).toHaveTextContent('No sports on your dates.');

    fireEvent.press(screen.getByTestId('discover-filter-all'));
    fireEvent.changeText(screen.getByTestId('discover-search'), 'market');
    expect(screen.getByTestId(`${VEGAS_ROW}-empty`)).toHaveTextContent('No events match "market".');
    expect(screen.getByTestId(`${CAPE_ROW}-empty`)).toHaveTextContent('No events match "market".');
  });
});

describe('The trip line’s "All upcoming trips" option', () => {
  it('switches the selected trip to every upcoming trip and back', async () => {
    await open('vegas-discover', 'discover-events');
    fireEvent.press(screen.getByTestId('discover-trip-title'));
    const all = await screen.findByTestId('discover-trip-title-switcher-all');
    expect(all.props.accessibilityLabel).toBe('All upcoming trips, Las Vegas, Cape Town, Tokyo');
    expect(screen.getByTestId('discover-trip-title-switcher-trip-vegas')).toBeSelected();
    expect(all).not.toBeSelected();

    fireEvent.press(all);
    await screen.findByTestId(`${CAPE_ROW}-empty`);
    expect(useTripStore.getState().discoverAll).toBe(true);
    expect(sectionTitles()).toEqual([
      "While you're in Las Vegas · Nov 12 – 16",
      "Because you're going to Cape Town · Dec 18 – Jan 6",
      "Because you're going to Tokyo · Mar 20 – 29",
    ]);
    // Tokyo has no demo events on its dates.
    expect(await screen.findByTestId('discover-trip-trip-tokyo-events-empty')).toHaveTextContent(
      'No events found on your dates.',
    );
    // Plan and Organize keep their trip.
    expect(useTripStore.getState().selectedTripId).toBe('trip-vegas');

    fireEvent.press(screen.getByTestId('discover-trip-title'));
    expect(await screen.findByTestId('discover-trip-title-switcher-all')).toBeSelected();
    expect(screen.getByTestId('discover-trip-title-switcher-trip-vegas')).not.toBeSelected();
    fireEvent.press(screen.getByTestId('discover-trip-title-switcher-trip-vegas'));
    await screen.findByText('Happening in Las Vegas');
    expect(screen.queryByTestId('discover-all')).toBeNull();
    expect(useTripStore.getState().discoverAll).toBe(false);
  });
});
