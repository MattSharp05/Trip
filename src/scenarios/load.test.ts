import { isClockFixed, now } from '@/core/clock';
import { useActiveSource } from '@/services/data/active';
import { useScenarioStore } from '@/stores/scenario';
import { useTripStore } from '@/stores/trip';

import { isScenarioActive, scenariosEnabled } from './enabled';
import { scenarioLink } from './link';
import { exitScenario, loadScenario } from './load';
import { DEFAULT_TODAY, SCENARIOS } from './registry';

const state = () => ({
  today: now().toISOString(),
  source: useActiveSource.getState().source.kind,
  tripId: useTripStore.getState().selectedTripId,
  scenario: useScenarioStore.getState().active,
  view: useScenarioStore.getState().view,
});

describe('loadScenario', () => {
  afterEach(() => exitScenario());

  it.each([
    ['vegas-plan-day-2', 'plan', 'trip-vegas', { day: '2026-11-13', planMode: 'itinerary' }],
    [
      'vegas-flight-day',
      'plan',
      'trip-vegas',
      { day: '2026-11-12', itemId: 'item-01', planMode: 'itinerary' },
    ],
    ['vegas-bucket', 'plan', 'trip-vegas', { planMode: 'bucket' }],
    ['vegas-wallet', 'organize', 'trip-vegas', { organizeView: 'wallet' }],
    ['vegas-budget-eur', 'organize', 'trip-vegas', { organizeView: 'budget', currency: 'EUR' }],
    ['empty-account', 'trips', null, {}],
  ])('%s opens %s with the expected state', (name, tab, tripId, view) => {
    expect(loadScenario(name)).toBe(tab);
    expect(state()).toMatchObject({ source: 'demo', tripId, scenario: name, view });
    expect(isScenarioActive()).toBe(true);
  });

  it('pins today to Fri Nov 13, 9:00 AM in Las Vegas unless the scenario sets it', () => {
    loadScenario('vegas-plan-day-2');
    expect(now().toISOString()).toBe(new Date(DEFAULT_TODAY).toISOString());
    expect(now().toISOString()).toBe('2026-11-13T17:00:00.000Z');
    loadScenario('vegas-flight-day');
    expect(now().toISOString()).toBe('2026-11-12T12:30:00.000Z');
  });

  it('loads the scenario data into the demo session', async () => {
    loadScenario('vegas-wallet');
    const source = useActiveSource.getState().source;
    expect(await source.listTrips()).toHaveLength(4);
    expect(await source.listDocuments()).toHaveLength(1);
    loadScenario('empty-account');
    expect(await useActiveSource.getState().source.listTrips()).toEqual([]);
  });

  it('starts each load from clean fixtures', async () => {
    loadScenario('vegas-bucket');
    await useActiveSource.getState().source.deleteBucketItem('bucket-pinball');
    loadScenario('vegas-bucket');
    const data = await useActiveSource.getState().source.getTripData('trip-vegas');
    expect(data?.bucketItems).toHaveLength(5);
  });

  it('ignores an unknown name', () => {
    expect(loadScenario('nope')).toBeNull();
    expect(isScenarioActive()).toBe(false);
    expect(state().source).toBe('supabase');
  });

  it('exitScenario restores the real account', () => {
    loadScenario('vegas-wallet');
    exitScenario();
    expect(state()).toMatchObject({ source: 'supabase', tripId: null, scenario: null, view: {} });
    expect(isClockFixed()).toBe(false);
  });

  it('every scenario has a unique name and a valid today', () => {
    expect(new Set(SCENARIOS.map((s) => s.name)).size).toBe(SCENARIOS.length);
    for (const s of SCENARIOS) expect(Number.isNaN(Date.parse(s.today))).toBe(false);
  });
});

describe('scenariosEnabled', () => {
  it('is on in dev builds and with EXPO_PUBLIC_SCENARIOS=1, off otherwise', () => {
    expect(scenariosEnabled(undefined, true)).toBe(true);
    expect(scenariosEnabled('1', false)).toBe(true);
    expect(scenariosEnabled(undefined, false)).toBe(false);
    expect(scenariosEnabled('0', false)).toBe(false);
  });
});

describe('scenarioLink', () => {
  it('builds the Expo Go link to the main channel', () => {
    expect(scenarioLink('vegas-plan-day-2')).toBe(
      'exp://u.expo.dev/0458c1dd-61a0-47f7-ac52-c648b4458fea/--/scenario/vegas-plan-day-2?runtime-version=exposdk:57.0.0&channel-name=main',
    );
  });

  it('builds the standalone-build link', () => {
    expect(scenarioLink('empty-account', 'trip')).toBe('trip://scenario/empty-account');
  });
});
