import { act, fireEvent, renderRouter, screen, waitFor, within } from 'expo-router/testing-library';

import TabLayout from '../app/(tabs)/_layout';
import PlanScreen from '../app/(tabs)/plan/index';
import ScenarioRoute from '../app/scenario/[name]';
import RootLayout from '../app/_layout';
import { resetFakeAuth } from '@/features/auth/testing';
import { exitScenario } from '@/scenarios';
import { useSelectionStore } from '@/stores/selection';

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

/** The suggestion rows' bucket ids, top to bottom. */
const rows = () =>
  screen
    .queryAllByTestId(/^suggest-row-/)
    .map((row) => row.props.testID.replace('suggest-row-', ''));

beforeEach(() => resetFakeAuth(null));
afterEach(() => act(() => exitScenario()));

describe('Suggest times for liked items (TR-64)', () => {
  it('group-bucket-suggest opens on the liked items, most liked first', async () => {
    renderRouter(routes, { initialUrl: '/scenario/group-bucket-suggest' });
    await waitFor(() => expect(screen.getByTestId('suggest-row-bucket-golden-tiki')).toBeTruthy());
    expect(rows()).toEqual(['bucket-golden-tiki', 'bucket-lotus-of-siam']);
    expect(screen.getByText('Sun 15, 4:00 PM · 2 likes')).toBeTruthy();
    expect(screen.getByText('Sat 14, 3:45 PM · 1 like')).toBeTruthy();
    expect(screen.getByTestId('suggest-accept-all')).toBeTruthy();
  });

  it("accepting Blake's Golden Tiki plans it on Sun 15 as added by Blake, with Undo", async () => {
    renderRouter(routes, { initialUrl: '/scenario/group-bucket-suggest' });
    const accept = await screen.findByTestId('suggest-accept-bucket-golden-tiki');
    await act(async () => fireEvent.press(accept));

    expect(await screen.findByText('Added Golden Tiki to Sun 15, 4:00 PM')).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Itinerary' })).toBeSelected();
    const { selectedDay, selectedItemId } = useSelectionStore.getState();
    expect(selectedDay).toBe('2026-11-15');
    const row = await screen.findByTestId(`itinerary-row-${selectedItemId}`);
    expect(within(row).getByText(/^Added by Blake/)).toBeTruthy();
    await waitFor(() => expect(screen.getByRole('tab', { name: 'Bucket List (4)' })).toBeTruthy());

    await act(async () => fireEvent.press(screen.getByText('Undo')));
    await waitFor(() => expect(screen.getByRole('tab', { name: 'Bucket List (5)' })).toBeTruthy());
  });

  it('Skip leaves an item out; Accept all places the rest', async () => {
    renderRouter(routes, { initialUrl: '/scenario/group-bucket-suggest' });
    const skip = await screen.findByTestId('suggest-skip-bucket-golden-tiki');
    await act(async () => fireEvent.press(skip));
    expect(rows()).toEqual(['bucket-lotus-of-siam']);
    // One left: no Accept all.
    expect(screen.queryByTestId('suggest-accept-all')).toBeNull();
    await act(async () =>
      fireEvent.press(screen.getByTestId('suggest-accept-bucket-lotus-of-siam')),
    );
    expect(await screen.findByText('Added Lotus of Siam to Sat 14, 3:45 PM')).toBeTruthy();
    await waitFor(() => expect(screen.getByRole('tab', { name: 'Bucket List (4)' })).toBeTruthy());
  });

  it('shows the button on the group Bucket List; Accept all places every suggestion', async () => {
    renderRouter(routes, { initialUrl: '/scenario/group-bucket-popular' });
    expect(await screen.findByTestId('bucket-suggest')).toBeTruthy();
    expect(screen.getByText('Suggest times for liked items')).toBeTruthy();
    await act(async () => fireEvent.press(screen.getByTestId('bucket-suggest')));
    await waitFor(() => expect(rows()).toEqual(['bucket-golden-tiki', 'bucket-lotus-of-siam']));
    await act(async () => fireEvent.press(screen.getByTestId('suggest-accept-all')));
    expect(await screen.findByText('Added 2 liked items\nSat 14 and Sun 15')).toBeTruthy();
    await waitFor(() => expect(screen.getByRole('tab', { name: 'Bucket List (3)' })).toBeTruthy());
  });

  it('has no button on a trip of one', async () => {
    renderRouter(routes, { initialUrl: '/scenario/vegas-bucket' });
    await screen.findByTestId('bucket-list');
    expect(screen.queryByTestId('bucket-suggest')).toBeNull();
  });
});
