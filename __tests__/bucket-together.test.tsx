import { act, fireEvent, renderRouter, screen, waitFor, within } from 'expo-router/testing-library';

import TabLayout from '../app/(tabs)/_layout';
import PlanScreen from '../app/(tabs)/plan/index';
import ScenarioRoute from '../app/scenario/[name]';
import RootLayout from '../app/_layout';
import { resetFakeAuth } from '@/features/auth/testing';
import { exitScenario } from '@/scenarios';
import { queryClient } from '@/services/data';
import { useActiveSource } from '@/services/data/active';

jest.mock('@/services/supabase', () => ({
  supabase: { auth: require('@/features/auth/testing').fakeAuth },
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

async function open(scenario: string) {
  await renderRouter(routes, { initialUrl: `/scenario/${scenario}` });
  await screen.findByTestId('bucket-list');
}

/** The rows' ids, top to bottom. */
const order = () =>
  within(screen.getByTestId('bucket-list'))
    .getAllByTestId(/^bucket-row-/)
    .map((row) => row.props.testID.replace('bucket-row-', ''));

const likes = (id: string) => screen.queryByTestId(`bucket-likes-${id}`)?.props.children ?? 0;
const origin = (id: string) => screen.getByTestId(`bucket-origin-${id}`).props.children;

beforeEach(() => resetFakeAuth(null));
afterEach(() => {
  jest.restoreAllMocks();
  act(() => exitScenario());
});

describe('Bucket List together on group-bucket-popular', () => {
  it('Popular puts the most liked first, then the newest; Recent is newest first', async () => {
    await open('group-bucket-popular');
    expect(order()).toEqual([
      'bucket-golden-tiki',
      'bucket-lotus-of-siam',
      'bucket-fred-again',
      'bucket-pinball',
      'bucket-fremont',
    ]);
    await waitFor(() => expect(likes('bucket-golden-tiki')).toBe(2));
    await waitFor(() => expect(likes('bucket-lotus-of-siam')).toBe(1));
    await waitFor(() => expect(likes('bucket-pinball')).toBe(0));

    await act(async () => fireEvent.press(screen.getByText('Recent')));
    expect(order()).toEqual([
      'bucket-fred-again',
      'bucket-pinball',
      'bucket-lotus-of-siam',
      'bucket-fremont',
      'bucket-golden-tiki',
    ]);
  });

  it('says who added each item', async () => {
    await open('group-bucket-popular');
    await waitFor(() =>
      expect(origin('bucket-golden-tiki')).toBe('Added by Blake · Saved from TikTok'),
    );
    expect(origin('bucket-fremont')).toBe('Added by you · From search');
    expect(screen.getByTestId('bucket-row-bucket-golden-tiki')).toHaveAccessibleName(
      'Golden Tiki, 3939 Spring Mountain Rd · Bar, Added by Blake · Saved from TikTok, 2 likes',
    );
  });

  it('tapping the heart likes and unlikes at once, and saves it', async () => {
    await open('group-bucket-popular');
    const heart = () => screen.getByTestId('bucket-like-bucket-pinball');
    await waitFor(() => expect(heart()).toHaveAccessibleName('Like'));

    await act(async () => fireEvent.press(heart()));
    await waitFor(() => expect(likes('bucket-pinball')).toBe(1));
    expect(heart()).toHaveAccessibleName('Unlike');
    // One like now, like Lotus of Siam: Pinball, the newer of the two, moves up above it.
    expect(order().slice(0, 3)).toEqual([
      'bucket-golden-tiki',
      'bucket-pinball',
      'bucket-lotus-of-siam',
    ]);
    const saved = await useActiveSource.getState().source.getTripData('trip-vegas');
    expect(saved?.bucketItems.find((b) => b.id === 'bucket-pinball')?.likedBy).toEqual([
      'user-matthew',
    ]);

    await act(async () => fireEvent.press(heart()));
    await waitFor(() => expect(likes('bucket-pinball')).toBe(0));
    expect(heart()).toHaveAccessibleName('Like');
  });

  it('a quick like then unlike saves in that order, ending unliked', async () => {
    await open('group-bucket-popular');
    const heart = await screen.findByTestId('bucket-like-bucket-fremont');
    await waitFor(() => expect(heart).toHaveAccessibleName('Like'));
    const source = useActiveSource.getState().source;
    const like = source.likeBucketItem.bind(source);
    // The like is slow to save; the unlike must still go after it.
    jest
      .spyOn(source, 'likeBucketItem')
      .mockImplementationOnce((item) =>
        new Promise((r) => setTimeout(r, 50)).then(() => like(item)),
      );

    await act(async () => fireEvent.press(heart));
    await waitFor(() => expect(likes('bucket-fremont')).toBe(1));
    await act(async () => fireEvent.press(screen.getByTestId('bucket-like-bucket-fremont')));
    await waitFor(() => expect(likes('bucket-fremont')).toBe(0));

    // Both saves done (the slow like first), and the refetch agrees.
    await waitFor(() => expect(source.likeBucketItem).toHaveBeenCalledTimes(1));
    await waitFor(async () => {
      const saved = await source.getTripData('trip-vegas');
      expect(saved?.bucketItems.find((b) => b.id === 'bucket-fremont')).not.toHaveProperty(
        'likedBy',
      );
    });
    await waitFor(() => expect(queryClient.isMutating()).toBe(0));
    expect(likes('bucket-fremont')).toBe(0);
  });

  it('rolls the like back with a message when it fails to save', async () => {
    await open('group-bucket-popular');
    const source = useActiveSource.getState().source;
    let fail: (error: Error) => void = () => {};
    jest
      .spyOn(source, 'likeBucketItem')
      .mockImplementationOnce(() => new Promise((_, reject) => (fail = reject)));
    await waitFor(() =>
      expect(screen.getByTestId('bucket-like-bucket-lotus-of-siam')).toHaveAccessibleName('Like'),
    );

    await act(async () => fireEvent.press(screen.getByTestId('bucket-like-bucket-lotus-of-siam')));
    await waitFor(() => expect(likes('bucket-lotus-of-siam')).toBe(2));

    await act(async () => fail(new Error('offline')));
    await waitFor(() => expect(likes('bucket-lotus-of-siam')).toBe(1));
    expect(screen.getByText("Couldn't save your like. Try again.")).toBeTruthy();
  });
});

describe('Bucket List on a trip you are alone on (vegas-bucket)', () => {
  it('shows no "Added by" line and still lets you like', async () => {
    await open('vegas-bucket');
    const heart = await screen.findByTestId('bucket-like-bucket-fremont');
    expect(screen.queryByText(/Added by/)).toBeNull();
    await act(async () => fireEvent.press(heart));
    await waitFor(() => expect(likes('bucket-fremont')).toBe(1));
  });
});
