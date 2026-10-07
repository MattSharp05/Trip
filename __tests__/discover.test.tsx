import { act, fireEvent, renderRouter, screen, waitFor, within } from 'expo-router/testing-library';

import TabLayout from '../app/(tabs)/_layout';
import DiscoverScreen from '../app/(tabs)/discover/index';
import ScenarioRoute from '../app/scenario/[name]';
import RootLayout from '../app/_layout';
import { resetFakeAuth } from '@/features/auth/testing';
import { exitScenario } from '@/scenarios';
import { useActiveSource } from '@/services/data';

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

async function openDiscover() {
  renderRouter(routes, { initialUrl: '/scenario/vegas-discover' });
  await screen.findByTestId('discover-events');
}

/** Each card's visible text, left to right. */
const cards = (row: string) =>
  within(screen.getByTestId(row))
    .getAllByTestId(new RegExp(`^${row}-card-`))
    .filter((card) => !/-(add|saved|planned)$/.test(card.props.testID))
    .map((card) =>
      within(card)
        .queryAllByText(/./)
        .map((t) => t.props.children)
        .join(' | '),
    );

const card = (id: string) => screen.getByTestId(`discover-events-card-${id}`);

beforeEach(() => resetFakeAuth(null));
afterEach(() => act(() => exitScenario()));

describe('Discover on vegas-discover', () => {
  it('shows the trip line and the events on the trip’s dates, earliest first', async () => {
    await openDiscover();
    expect(screen.getByText('Discover')).toBeTruthy();
    expect(screen.getByTestId('discover-trip-title')).toHaveTextContent(
      'Las Vegas · Nov 12 – Nov 16, 2026',
    );
    expect(screen.getByText('Happening in Las Vegas')).toBeTruthy();
    expect(cards('discover-events')).toEqual([
      'O by Cirque du Soleil | Nov 12 · 7:00 PM | O Theatre at Bellagio',
      'Vegas Golden Knights vs. Seattle Kraken | Nov 13 · 7:00 PM | T-Mobile Arena',
      'Late night at Zouk Nightclub | Nov 13 · 10:30 PM | Zouk Nightclub',
      'Downtown Las Vegas Food Tour | Nov 14 · 12:00 PM | Fremont Street Experience',
      'Fred again.. | Nov 14 · 8:00 PM | XS Nightclub',
      'Wine and Small Plates Walk | Nov 15 · 4:00 PM | The Forum Shops',
      'UFC 310 | Nov 15 · 6:00 PM | T-Mobile Arena | Planned',
      'Comedy Cellar Late Show | Nov 16 · 9:30 PM | Rio Hotel & Casino',
    ]);
    expect(screen.getByText('Popular with travellers')).toBeTruthy();
  });

  it('shows Fred again.. as saved and UFC 310 as planned, without a +', async () => {
    await openDiscover();
    expect(
      within(card('fx:fred-again-xs-1114')).getByLabelText('Saved to your Bucket List'),
    ).toBeTruthy();
    expect(screen.queryByTestId('discover-events-card-fx:fred-again-xs-1114-add')).toBeNull();
    expect(within(card('fx:ufc-310-1115')).getByText('Planned')).toBeTruthy();
    expect(screen.queryByTestId('discover-events-card-fx:ufc-310-1115-add')).toBeNull();
  });

  it('filters by chip, and Networking is empty for now', async () => {
    await openDiscover();
    fireEvent.press(screen.getByTestId('discover-filter-sports'));
    expect(screen.getByTestId('discover-filter-sports')).toBeSelected();
    expect(cards('discover-events').map((c) => c.split(' | ')[0])).toEqual([
      'Vegas Golden Knights vs. Seattle Kraken',
      'UFC 310',
    ]);
    // Sports has no curated places.
    expect(screen.queryByText('Popular with travellers')).toBeNull();

    fireEvent.press(screen.getByTestId('discover-filter-food'));
    expect(cards('discover-events').map((c) => c.split(' | ')[0])).toEqual([
      'Downtown Las Vegas Food Tour',
      'Wine and Small Plates Walk',
    ]);
    expect(cards('discover-popular').every((c) => c.includes('| Food'))).toBe(true);

    fireEvent.press(screen.getByTestId('discover-filter-networking'));
    expect(screen.getByText('No networking events on your dates yet.')).toBeTruthy();
    expect(screen.queryByTestId('discover-events')).toBeNull();
  });

  it('searches loaded events by title and venue', async () => {
    await openDiscover();
    fireEvent.changeText(screen.getByTestId('discover-search'), 'arena');
    expect(cards('discover-events').map((c) => c.split(' | ')[0])).toEqual([
      'Vegas Golden Knights vs. Seattle Kraken',
      'UFC 310',
    ]);
    fireEvent.changeText(screen.getByTestId('discover-search'), 'opera');
    expect(screen.getByText('No events match "opera".')).toBeTruthy();
    fireEvent.press(screen.getByTestId('discover-search-clear'));
    expect(cards('discover-events')).toHaveLength(8);
  });

  it('+ saves an event to the Bucket List with its date, time and venue', async () => {
    await openDiscover();
    await act(async () =>
      fireEvent.press(screen.getByTestId('discover-events-card-fx:golden-knights-1113-add')),
    );
    await waitFor(() =>
      expect(
        within(card('fx:golden-knights-1113')).getByLabelText('Saved to your Bucket List'),
      ).toBeTruthy(),
    );
    expect(
      screen.getByText('Added Vegas Golden Knights vs. Seattle Kraken to your Bucket List'),
    ).toBeTruthy();

    const data = await useActiveSource.getState().source.getTripData('trip-vegas');
    const saved = data?.bucketItems.at(-1);
    expect(saved).toMatchObject({
      title: 'Vegas Golden Knights vs. Seattle Kraken',
      source: 'discover',
      fixedDate: '2026-11-13',
      fixedTime: '19:00',
      // The trip already knows the arena: no second place.
      placeId: 'place-t-mobile',
    });
  });

  it('+ on a popular place saves it with a new place', async () => {
    await openDiscover();
    await act(async () =>
      fireEvent.press(screen.getByTestId('discover-popular-card-popular-hells-kitchen-add')),
    );
    await waitFor(() =>
      expect(screen.getByTestId('discover-popular-card-popular-hells-kitchen-saved')).toBeTruthy(),
    );
    const data = await useActiveSource.getState().source.getTripData('trip-vegas');
    const place = data?.places.find((p) => p.name === "Hell's Kitchen");
    expect(place).toMatchObject({ kind: 'food', lat: 36.1162 });
    expect(data?.bucketItems.at(-1)).toMatchObject({ placeId: place?.id, fixedDate: null });
  });
});
