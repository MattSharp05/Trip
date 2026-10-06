import { router as nav } from 'expo-router';
import { act, fireEvent, renderRouter, screen, waitFor, within } from 'expo-router/testing-library';

import OrganizeLayout from '../app/(tabs)/organize/_layout';
import EditDocumentRoute from '../app/(tabs)/organize/document/[id]/edit';
import DocumentRoute from '../app/(tabs)/organize/document/[id]/index';
import NewDocumentRoute from '../app/(tabs)/organize/document/new';
import OrganizeRoute from '../app/(tabs)/organize/index';
import WalletItemRoute from '../app/(tabs)/organize/item/[id]';
import { exitScenario, loadScenario } from '@/scenarios';
import { useActiveSource } from '@/services/data/active';
import { useTripStore } from '@/stores/trip';

// The camera / library picker is native; the test "picks" a local photo.
const mockPick = jest.fn(async () => ['file:///var/mobile/passport.jpg']);
jest.mock('@/features/documents/photos', () => ({
  ...jest.requireActual('@/features/documents/photos'),
  pickDocumentPhotos: () => mockPick(),
}));

const routes = {
  '(tabs)/organize/_layout': OrganizeLayout,
  '(tabs)/organize/index': OrganizeRoute,
  '(tabs)/organize/item/[id]': WalletItemRoute,
  '(tabs)/organize/document/new': NewDocumentRoute,
  '(tabs)/organize/document/[id]/index': DocumentRoute,
  '(tabs)/organize/document/[id]/edit': EditDocumentRoute,
};

async function openWallet(scenario = 'vegas-wallet') {
  act(() => {
    loadScenario(scenario);
  });
  const router = renderRouter(routes, { initialUrl: '/organize' });
  await screen.findByTestId('wallet-card-document-passport');
  return router;
}

const documentCards = () =>
  within(screen.getByTestId('wallet-list'))
    .queryAllByTestId(/^wallet-card-document/)
    .map((el) => el.props.testID as string);

describe('Passport and visa documents (TR-20)', () => {
  afterEach(() => act(() => exitScenario()));

  it('adds a passport with a photo, and it shows on every trip', async () => {
    const router = await openWallet();
    fireEvent.press(screen.getByTestId('wallet-filter-document'));
    fireEvent.press(screen.getByTestId('wallet-add-document'));
    await act(async () => {});
    expect(router.getPathname()).toBe('/organize/document/new');

    fireEvent.press(screen.getByText('Visa'));
    fireEvent.changeText(screen.getByTestId('document-form-country'), 'India');
    fireEvent.changeText(screen.getByTestId('document-form-number'), 'v12345');
    fireEvent.press(screen.getByTestId('document-form-expiry-add'));
    fireEvent.press(screen.getByTestId('document-form-add-photo'));
    await waitFor(() => expect(mockPick).toHaveBeenCalled());
    fireEvent.press(screen.getByTestId('document-form-save'));
    await act(async () => {});

    expect(router.getPathname()).toBe('/organize');
    await waitFor(() => expect(documentCards()).toHaveLength(2));
    const saved = (await useActiveSource.getState().source.listDocuments()).find(
      (d) => d.type === 'visa',
    );
    expect(saved).toMatchObject({
      country: 'India',
      number: 'v12345',
      // The scenario's "today", Nov 13 2026.
      expiresOn: '2026-11-13',
      imagePaths: ['file:///var/mobile/passport.jpg'],
    });

    for (const trip of ['trip-tokyo', 'trip-cape-town', 'trip-new-york']) {
      act(() => useTripStore.getState().selectTrip(trip));
      await waitFor(() => expect(documentCards()).toHaveLength(2));
    }
  });

  it('asks for the missing fields instead of saving', async () => {
    const router = await openWallet();
    act(() => nav.push('/organize/document/new'));
    fireEvent.press(await screen.findByTestId('document-form-save'));
    expect(await screen.findByText('Add the issuing country.')).toBeOnTheScreen();
    fireEvent.changeText(screen.getByTestId('document-form-country'), 'Japan');
    fireEvent.press(screen.getByTestId('document-form-save'));
    expect(await screen.findByText('Add the expiry date.')).toBeOnTheScreen();
    expect(router.getPathname()).toBe('/organize/document/new');
  });

  it('opens the passport detail, and edits it', async () => {
    const router = await openWallet();
    expect(screen.queryByTestId('document-warning')).toBeNull();
    fireEvent.press(screen.getByTestId('wallet-card-document-passport'));
    await act(async () => {});
    expect(router.getPathname()).toBe('/organize/document/document-passport');
    expect(await screen.findByText('Jun 30, 2034')).toBeOnTheScreen();
    expect(screen.getByTestId('document-no-photo')).toBeOnTheScreen();
    expect(screen.getByText('Saved to your account only and never sent to AI.')).toBeOnTheScreen();
    expect(screen.queryByTestId('document-warning')).toBeNull();

    act(() => nav.push('/organize/document/document-passport/edit'));
    const country = await screen.findByTestId('document-form-country');
    expect(country.props.value).toBe('United States');
    fireEvent.changeText(country, 'Canada');
    fireEvent.press(screen.getByTestId('document-form-add-photo'));
    await waitFor(() => expect(screen.getByTestId('document-form-remove-0')).toBeOnTheScreen());
    fireEvent.press(screen.getByTestId('document-form-save'));
    await act(async () => {});

    expect(router.getPathname()).toBe('/organize/document/document-passport');
    expect(await screen.findByText('Canada')).toBeOnTheScreen();
    fireEvent.press(screen.getByTestId('document-photo-0'));
    expect(await screen.findByTestId('document-photo-zoom-0')).toBeOnTheScreen();
    fireEvent.press(screen.getByTestId('document-photo-close'));
  });

  it('warns on a passport that expires too soon for an upcoming trip', async () => {
    const router = await openWallet('vegas-passport-expiring');
    expect(await screen.findByText('Passport · United States')).toBeOnTheScreen();
    expect(screen.getByText('Expires Aug 2027')).toBeOnTheScreen();
    // Fine for Las Vegas and Cape Town; Tokyo ends Mar 29, 2027 and needs Sep 29.
    expect(screen.getByText('Under 6 months left after Tokyo')).toBeOnTheScreen();

    fireEvent.press(screen.getByTestId('wallet-card-document-passport'));
    await act(async () => {});
    expect(router.getPathname()).toBe('/organize/document/document-passport');
    expect(await screen.findByTestId('document-warning')).toBeOnTheScreen();
    expect(screen.getByText('567 890 123')).toBeOnTheScreen();
  });
});
