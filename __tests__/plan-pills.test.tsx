import { act, fireEvent, renderRouter, screen, within } from 'expo-router/testing-library';

import TabLayout from '../app/(tabs)/_layout';
import PlanScreen from '../app/(tabs)/plan/index';
import ScenarioRoute from '../app/scenario/[name]';
import RootLayout from '../app/_layout';
import { resetFakeAuth } from '@/features/auth/testing';
import { pillOffset, PILL_WIDTH } from '@/features/plan';
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

const DAYS = ['2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15', '2026-11-16'];
const fetchMock = jest.fn();

async function openPlan(scenario: string) {
  renderRouter(routes, { initialUrl: `/scenario/${scenario}` });
  // Fixture weather arrives through the query: wait for it on the selected day.
  return screen.findByTestId('day-header-weather');
}

const pillText = (day: string) =>
  within(screen.getByTestId(`pill-${day}`))
    .queryAllByText(/./)
    .map((t) => t.props.children)
    .join(' ');

beforeEach(() => {
  resetFakeAuth(null);
  fetchMock.mockReset();
  global.fetch = fetchMock as unknown as typeof fetch;
});
afterEach(() => act(() => exitScenario()));

describe('Plan date pills on vegas-plan-day-2', () => {
  it('shows Thu 12 – Mon 16 with Fri 13 selected and fixture weather', async () => {
    await openPlan('vegas-plan-day-2');
    expect(DAYS.map(pillText)).toEqual([
      'Thu 12 73°',
      'Fri 13 75°',
      'Sat 14 74°',
      'Sun 15 71°',
      'Mon 16 69°',
    ]);
    for (const day of DAYS) {
      expect(screen.getByTestId(`pill-${day}`).props.accessibilityState.selected).toBe(
        day === '2026-11-13',
      );
      expect(screen.getByTestId(`pill-weather-${day}`)).toBeTruthy();
    }
    expect(screen.getByTestId('pill-2026-11-13').props.accessibilityLabel).toBe(
      'Friday, November 13, Clear, high 75°',
    );
    // Demo sessions never call the weather API.
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('shows the trip header and the day header with high and low', async () => {
    await openPlan('vegas-plan-day-2');
    const header = screen.getByTestId('plan-header');
    expect(within(header).getByText('Las Vegas')).toBeTruthy();
    expect(within(header).getByText('Nov 12 – Nov 16, 2026')).toBeTruthy();
    expect(screen.getByTestId('day-header-title').props.children).toBe('Fri, Nov 13');
    const weather = screen.getByTestId('day-header-weather');
    expect(within(weather).getByText('75°')).toBeTruthy();
    expect(within(weather).getByText('55°')).toBeTruthy();
  });

  it('tapping a pill selects the day in the store, the day header and the map', async () => {
    await openPlan('vegas-plan-day-2');
    fireEvent.press(screen.getByTestId('pill-2026-11-15'));
    expect(useSelectionStore.getState().selectedDay).toBe('2026-11-15');
    expect(screen.getByTestId('day-header-title').props.children).toBe('Sun, Nov 15');
    expect(within(screen.getByTestId('day-header-weather')).getByText('71°')).toBeTruthy();
    expect(screen.getByTestId('pill-2026-11-15').props.accessibilityState.selected).toBe(true);
    expect(screen.getByTestId('pill-2026-11-13').props.accessibilityState.selected).toBe(false);
  });

  it("opens vegas-flight-day on the scenario's day", async () => {
    await openPlan('vegas-flight-day');
    expect(screen.getByTestId('day-header-title').props.children).toBe('Thu, Nov 12');
    expect(screen.getByTestId('pill-2026-11-12').props.accessibilityState.selected).toBe(true);
  });
});

describe('pillOffset', () => {
  it('centres the pill and never scrolls before the start', () => {
    expect(pillOffset(0, 390)).toBe(0);
    const offset = pillOffset(10, 390);
    // The pill's centre sits at the middle of the viewport.
    expect(16 + 10 * (PILL_WIDTH + 8) + PILL_WIDTH / 2 - offset).toBe(195);
  });
});
