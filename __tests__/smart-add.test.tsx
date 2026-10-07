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

async function openBucket() {
  renderRouter(routes, { initialUrl: '/scenario/vegas-bucket' });
  await screen.findByTestId('bucket-list');
}

/** The itinerary's titles, top to bottom. */
const titles = () =>
  within(screen.getByTestId('itinerary-list'))
    .getAllByTestId(/^itinerary-row-/)
    .map((row) => within(row).getAllByText(/./)[1].props.children as string);

beforeEach(() => resetFakeAuth(null));
afterEach(() => act(() => exitScenario()));

describe('Smart Add on vegas-bucket', () => {
  it('places Golden Tiki, opens its day with it selected, and Undo puts everything back', async () => {
    await openBucket();
    await act(async () => fireEvent.press(screen.getByTestId('smart-add-bucket-golden-tiki')));

    expect(
      await screen.findByText('Added to Sun 15, 4:00 PM · 9 min drive from AREA15'),
    ).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Itinerary' })).toBeSelected();
    await waitFor(() => expect(screen.getByRole('tab', { name: 'Bucket List (4)' })).toBeTruthy());
    const { selectedDay, selectedItemId } = useSelectionStore.getState();
    expect(selectedDay).toBe('2026-11-15');
    await waitFor(() => expect(titles()).toEqual(['AREA15', 'Golden Tiki', 'UFC 310']));
    expect(screen.getByTestId(`itinerary-row-${selectedItemId}`)).toBeSelected();

    await act(async () => fireEvent.press(screen.getByText('Undo')));
    await waitFor(() => expect(titles()).toEqual(['AREA15', 'UFC 310']));
    await waitFor(() => expect(screen.getByRole('tab', { name: 'Bucket List (5)' })).toBeTruthy());
  });

  it('places the Fred again.. event on its own date and time', async () => {
    await openBucket();
    await act(async () => fireEvent.press(screen.getByTestId('smart-add-bucket-fred-again')));
    expect(
      await screen.findByText('Added to Sat 14, 8:00 PM · 9 min drive from The Forum Shops'),
    ).toBeTruthy();
    await waitFor(() =>
      expect(titles()).toEqual(['Gondola at The Venetian', 'The Forum Shops', 'Fred again..']),
    );
  });
});
