import { act, renderRouter, screen, within } from 'expo-router/testing-library';

import TabLayout from '../app/(tabs)/_layout';
import PlanScreen from '../app/(tabs)/plan/index';
import ScenarioRoute from '../app/scenario/[name]';
import RootLayout from '../app/_layout';
import { resetFakeAuth } from '@/features/auth/testing';
import { usePreferenceStore } from '@/features/settings/usePreferences';
import { exitScenario } from '@/scenarios';
import { colors } from '@/theme';

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

async function openPlan(scenario: string) {
  renderRouter(routes, { initialUrl: `/scenario/${scenario}` });
  await screen.findByTestId('itinerary-list');
}

/** The caption of the leg under a row, and whether it's drawn in orange. */
function leg(itemId: string) {
  const caption = within(screen.getByTestId(`travel-leg-${itemId}`)).getByText(/./);
  const style = [caption.props.style].flat(Infinity);
  return {
    text: caption.props.children as string,
    orange: style.some((s) => s?.color === colors.accent),
  };
}

beforeEach(() => resetFakeAuth(null));
afterEach(() => act(() => exitScenario()));

describe('travel legs between itinerary rows', () => {
  it("vegas-plan-day-2: legs between Friday's stops, a short walk from brunch to the fountains", async () => {
    await openPlan('vegas-plan-day-2');
    act(() => usePreferenceStore.getState().set('demo:vegas-plan-day-2', { distanceUnit: 'km' }));

    expect(leg('item-05')).toEqual({ text: '3 min walk · 0.2 km', orange: false });
    expect(
      screen.getByTestId('travel-leg-item-05-walk', { includeHiddenElements: true }),
    ).toBeTruthy();
    expect(leg('item-06')).toEqual({ text: '9 min drive · 1.8 km', orange: false });
    expect(
      screen.getByTestId('travel-leg-item-06-drive', { includeHiddenElements: true }),
    ).toBeTruthy();
    expect(leg('item-07').text).toBe('10 min drive · 2.6 km');
    // Nothing after the last stop.
    expect(screen.queryByTestId('travel-leg-item-08')).toBeNull();
  });

  it('shows distances in miles when that is the preference', async () => {
    await openPlan('vegas-plan-day-2');
    act(() =>
      usePreferenceStore.getState().set('demo:vegas-plan-day-2', { distanceUnit: 'miles' }),
    );
    expect(leg('item-06').text).toBe('9 min drive · 1.1 mi');
  });

  it('vegas-plan-tight: a leg longer than the gap is an orange warning', async () => {
    await openPlan('vegas-plan-tight');
    expect(leg('item-06')).toEqual({ text: 'Tight: 9 min drive, 5 min gap', orange: true });
    expect(leg('item-05').orange).toBe(false);
  });
});
