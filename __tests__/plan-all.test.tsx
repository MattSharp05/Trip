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

describe('Plan my bucket list on vegas-bucket', () => {
  it('places all five items in one tap, opens the first day, and one Undo puts them all back', async () => {
    await openBucket();
    await act(async () => fireEvent.press(screen.getByTestId('bucket-plan-all')));

    expect(
      await screen.findByText('Placed 5 items across your trip\nThu 12, Fri 13, Sat 14 and Sun 15'),
    ).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Itinerary' })).toBeSelected();
    await waitFor(() => expect(screen.getByRole('tab', { name: 'Bucket List (0)' })).toBeTruthy());
    const { selectedDay, selectedItemId } = useSelectionStore.getState();
    expect(selectedDay).toBe('2026-11-12');
    await waitFor(() => expect(titles()).toContain('Pinball Hall of Fame'));
    expect(titles()).toContain('Fremont Street Experience');
    expect(screen.getByTestId(`itinerary-row-${selectedItemId}`)).toBeSelected();

    await act(async () => fireEvent.press(screen.getByText('Undo')));
    await waitFor(() => expect(screen.getByRole('tab', { name: 'Bucket List (5)' })).toBeTruthy());
    await waitFor(() => expect(titles()).not.toContain('Pinball Hall of Fame'));
    expect(titles()).not.toContain('Fremont Street Experience');
  });
});
