import * as Clipboard from 'expo-clipboard';
import { act, fireEvent, renderRouter, screen, waitFor, within } from 'expo-router/testing-library';
import * as WebBrowser from 'expo-web-browser';
import { AppState, type AppStateStatus } from 'react-native';

import TabLayout from '../app/(tabs)/_layout';
import PlanScreen from '../app/(tabs)/plan/index';
import ScenarioRoute from '../app/scenario/[name]';
import RootLayout from '../app/_layout';
import { LINK_SAMPLES } from '../supabase/functions/_shared/parse/linkFixtures';
import { resetFakeAuth } from '@/features/auth/testing';
import { useClipboardOfferStore } from '@/features/links';
import { exitScenario } from '@/scenarios';
import { searchSpots } from '@/services/places';

jest.mock('@/services/supabase', () => ({
  supabase: { auth: require('@/features/auth/testing').fakeAuth },
}));

jest.mock('@/services/places', () => ({
  searchPlaces: jest.fn(async () => []),
  searchSpots: jest.fn(async () => [
    {
      id: 'N77',
      name: 'Kaiseki Yuzu',
      kind: 'food',
      area: 'Spring Valley',
      address: '5115 Spring Mountain Road, Spring Valley',
      lat: 36.1258,
      lng: -115.2105,
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

const VEGAS_FOOD = LINK_SAMPLES['vegas-food'].result;

const hasUrl = jest.mocked(Clipboard.hasUrlAsync);
const getString = jest.mocked(Clipboard.getStringAsync);
const openBrowser = jest.mocked(WebBrowser.openBrowserAsync);

/** Each Bucket List row's visible text. */
const bucketRows = () =>
  within(screen.getByTestId('bucket-list'))
    .getAllByTestId(/^bucket-row-/)
    .map((row) =>
      within(row)
        .queryAllByText(/./)
        .map((t) => t.props.children)
        .join(' | '),
    );

/** The results sheet's place rows: name, line and whether it's ticked. */
const placeRows = () =>
  screen.getAllByTestId(/^link-place-/).map((row) => {
    const texts = within(row)
      .queryAllByText(/./)
      .map((t) => t.props.children);
    const ticked = row.props.accessibilityState?.checked;
    return `${ticked === undefined ? '?' : ticked ? 'x' : ' '} ${texts.join(' | ')}`;
  });

async function open(scenario: string) {
  renderRouter(routes, { initialUrl: `/scenario/${scenario}` });
  await screen.findByTestId('bucket-list');
}

beforeEach(() => {
  resetFakeAuth(null);
  hasUrl.mockResolvedValue(false);
  getString.mockResolvedValue('');
  openBrowser.mockClear();
  getString.mockClear();
  act(() => useClipboardOfferStore.setState({ offered: false }));
});
afterEach(() => act(() => exitScenario()));

describe('link-results', () => {
  it('shows the video and its places, located ones ticked, the rest with Find it', async () => {
    await open('link-results');
    expect(await screen.findByTestId('link-loading')).toBeTruthy();
    expect(await screen.findByText('From TikTok', {}, { timeout: 2000 })).toBeTruthy();
    expect(screen.getByText(VEGAS_FOOD.title!)).toBeTruthy();
    expect(screen.getByText('trip.sample')).toBeTruthy();
    expect(placeRows()).toEqual([
      "x Esther's Kitchen | Downtown · Food",
      'x Eggslut | The Strip · Food',
      'x Tacos El Gordo | The Strip · Food',
      '? Kaiseki Yuzu | Not found on the map | Find it',
    ]);

    fireEvent.press(screen.getByTestId('link-watch'));
    expect(openBrowser).toHaveBeenCalledWith(VEGAS_FOOD.url, expect.anything());
  });

  it('saves the ticked places to the Bucket List as "Saved from TikTok" with Watch', async () => {
    await open('link-results');
    await screen.findByText('From TikTok', {}, { timeout: 2000 });
    fireEvent.press(screen.getByTestId('link-place-place-1')); // untick Eggslut
    expect(placeRows()[1]).toBe('  Eggslut | The Strip · Food');

    await act(async () => fireEvent.press(screen.getByTestId('link-save')));

    await waitFor(() => expect(bucketRows()).toHaveLength(7));
    expect(bucketRows().slice(-2)).toEqual([
      "Esther's Kitchen | 1131 South Main Street · Food | Saved from TikTok | Smart Add",
      'Tacos El Gordo | 3049 South Las Vegas Boulevard · Food | Saved from TikTok | Smart Add',
    ]);
    expect(screen.getByText('Added 2 places to your Bucket List')).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Bucket List (7)' })).toBeSelected();

    // Each saved row's play button opens the video.
    const watch = screen.getAllByLabelText('Watch on TikTok');
    expect(watch).toHaveLength(3); // Golden Tiki (saved earlier) and the two new ones
    fireEvent.press(watch[2]);
    expect(openBrowser).toHaveBeenLastCalledWith(VEGAS_FOOD.url, expect.anything());
  });

  it('Find it searches for an unlocated place and ticks the match', async () => {
    await open('link-results');
    await screen.findByText('From TikTok', {}, { timeout: 2000 });
    fireEvent.press(screen.getByTestId('link-place-place-3'));
    expect(screen.getByText('Find a place')).toBeTruthy();
    expect(screen.getByTestId('spot-input').props.value).toBe('Kaiseki Yuzu');
    const match = await screen.findByTestId('spot-N77', {}, { timeout: 2000 });
    expect(searchSpots).toHaveBeenCalledWith('Kaiseki Yuzu', { lat: 36.1147, lng: -115.1728 });
    fireEvent.press(match);
    expect(placeRows()[3]).toBe('x Kaiseki Yuzu | Spring Valley · Food');
  });

  it('says when a video names no place, and offers search', async () => {
    await open('link-nothing-found');
    expect(
      await screen.findByText(
        "Couldn't find a place in this video. Search for it instead.",
        {},
        { timeout: 2000 },
      ),
    ).toBeTruthy();
    expect(screen.getByText('From Instagram')).toBeTruthy();
    fireEvent.press(screen.getByTestId('link-search'));
    expect(screen.getByTestId('spot-input')).toBeTruthy();
  });
});

describe('clipboard banner', () => {
  it('offers a copied link without reading the clipboard until it is tapped', async () => {
    hasUrl.mockResolvedValue(true);
    getString.mockResolvedValue(`Look at this! ${VEGAS_FOOD.url}`);
    await open('vegas-bucket');
    expect(await screen.findByTestId('link-banner')).toBeTruthy();
    expect(screen.getByText('Add this TikTok?')).toBeTruthy();
    expect(hasUrl).toHaveBeenCalled();
    expect(getString).not.toHaveBeenCalled();

    await act(async () => fireEvent.press(screen.getByTestId('link-banner-add')));
    expect(getString).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('link-banner')).toBeNull();
    expect(await screen.findByText('From TikTok', {}, { timeout: 2000 })).toBeTruthy();
    expect(placeRows()).toHaveLength(4);
  });

  it('can be dismissed until the app comes back to the foreground', async () => {
    const listeners: ((s: AppStateStatus) => void)[] = [];
    const spy = jest.spyOn(AppState, 'addEventListener').mockImplementation((type, fn) => {
      if (type === 'change') listeners.push(fn as (s: AppStateStatus) => void);
      return { remove: () => undefined } as ReturnType<typeof AppState.addEventListener>;
    });
    hasUrl.mockResolvedValue(true);
    await open('vegas-bucket');
    await screen.findByTestId('link-banner');
    fireEvent.press(screen.getByTestId('link-banner-dismiss'));
    expect(screen.queryByTestId('link-banner')).toBeNull();

    await act(async () => listeners.forEach((fn) => fn('background')));
    expect(screen.queryByTestId('link-banner')).toBeNull();
    await act(async () => listeners.forEach((fn) => fn('active')));
    expect(await screen.findByTestId('link-banner')).toBeTruthy();
    expect(getString).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('says plainly when the copied link is not a video', async () => {
    hasUrl.mockResolvedValue(true);
    getString.mockResolvedValue('https://example.com/menu');
    await open('vegas-bucket');
    await act(async () => fireEvent.press(await screen.findByTestId('link-banner-add')));
    expect(await screen.findByText("That link isn't a TikTok or an Instagram Reel.")).toBeTruthy();
  });
});

describe('Add sheet', () => {
  it('pastes a TikTok link from the clipboard, read on tap', async () => {
    getString.mockResolvedValue(VEGAS_FOOD.url);
    await open('vegas-bucket');
    fireEvent.press(screen.getByTestId('bucket-add'));
    expect(getString).not.toHaveBeenCalled();
    await act(async () => fireEvent.press(screen.getByTestId('bucket-paste-link')));
    expect(getString).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('From TikTok', {}, { timeout: 2000 })).toBeTruthy();
  });

  it('takes a link typed into the search field', async () => {
    await open('vegas-bucket');
    fireEvent.press(screen.getByTestId('bucket-add'));
    fireEvent.changeText(screen.getByTestId('spot-input'), VEGAS_FOOD.url);
    expect(searchSpots).not.toHaveBeenCalledWith(VEGAS_FOOD.url, expect.anything());
    await act(async () => fireEvent.press(screen.getByTestId('spot-link')));
    expect(await screen.findByText('From TikTok', {}, { timeout: 2000 })).toBeTruthy();
  });
});
