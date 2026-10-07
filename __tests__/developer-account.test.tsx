import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';

import DevIndexScreen from '../app/dev/index';
import RootLayout from '../app/_layout';
import { resetFakeAuth, testSession } from '@/features/auth/testing';
import { addSampleData, sampleVegasTripId } from '@/scenarios';
import { useActiveSource } from '@/services/data/active';
import { createDemoSource, type DataSource } from '@/services/data/source';
import { supabaseSource } from '@/services/data/supabaseSource';
import { useTripStore } from '@/stores/trip';

jest.mock('@/services/supabase', () => ({
  supabase: { auth: require('@/features/auth/testing').fakeAuth },
}));

const routes = {
  _layout: RootLayout,
  '(tabs)/_layout': () => null,
  '(tabs)/plan/index': () => null,
  'dev/index': DevIndexScreen,
};

/** An empty account, standing in for Supabase. */
function emptyAccount(): DataSource {
  const demo = createDemoSource({
    trips: [],
    places: [],
    items: [],
    bookings: [],
    bucketItems: [],
    expenses: [],
    documents: [],
  });
  return { ...demo, kind: 'supabase' };
}

afterEach(() => {
  act(() => {
    useActiveSource.getState().setSource(supabaseSource);
    useTripStore.getState().selectTrip(null);
  });
});

describe('Developer → Your account (TR-35)', () => {
  it('adds the sample Las Vegas trip to the signed-in account and opens it', async () => {
    resetFakeAuth(testSession);
    const account = emptyAccount();
    act(() => useActiveSource.getState().setSource(account));
    renderRouter(routes, { initialUrl: '/dev' });

    fireEvent.press(await screen.findByTestId('dev-add-sample'));
    const vegas = sampleVegasTripId(testSession.user.id);
    await waitFor(() => expect(useTripStore.getState().selectedTripId).toBe(vegas));
    expect((await account.getTripData(vegas))?.trip.city).toBe('Las Vegas');
    expect((await account.listTrips()).length).toBeGreaterThan(1);
  });

  it('removes the sample data again', async () => {
    resetFakeAuth(testSession);
    const account = emptyAccount();
    await addSampleData(account, testSession.user.id);
    act(() => useActiveSource.getState().setSource(account));
    renderRouter(routes, { initialUrl: '/dev' });

    fireEvent.press(await screen.findByTestId('dev-remove-sample'));
    expect(await screen.findByText('Sample data removed.')).toBeTruthy();
    expect(await account.listTrips()).toEqual([]);
  });

  it('is not offered signed out', async () => {
    resetFakeAuth(null);
    renderRouter(routes, { initialUrl: '/dev' });
    await screen.findByText('Developer');
    expect(screen.queryByTestId('dev-add-sample')).toBeNull();
  });
});
