import { AuthApiError, AuthRetryableFetchError } from '@supabase/supabase-js';
import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';

import TabLayout from '../app/(tabs)/_layout';
import DiscoverScreen from '../app/(tabs)/discover/index';
import OrganizeScreen from '../app/(tabs)/organize/index';
import PlanScreen from '../app/(tabs)/plan/index';
import TripsScreen from '../app/(tabs)/trips/index';
import AuthLayout from '../app/auth/_layout';
import ForgotPassword from '../app/auth/forgot-password';
import Welcome from '../app/auth/index';
import SignIn from '../app/auth/sign-in';
import SignUp from '../app/auth/sign-up';
import GalleryScreen from '../app/dev/gallery';
import ScenarioRoute from '../app/scenario/[name]';
import RootLayout from '../app/_layout';
import Index from '../app/index';
import { emitAuthChange, fakeAuth, resetFakeAuth, testSession } from '@/features/auth/testing';
import { exitScenario } from '@/scenarios';

jest.mock('@/services/supabase', () => ({
  supabase: { auth: require('@/features/auth/testing').fakeAuth },
}));

const routes = {
  _layout: RootLayout,
  index: Index,
  '(tabs)/_layout': TabLayout,
  '(tabs)/trips/index': TripsScreen,
  '(tabs)/plan/index': PlanScreen,
  '(tabs)/organize/index': OrganizeScreen,
  '(tabs)/discover/index': DiscoverScreen,
  'auth/_layout': AuthLayout,
  'auth/index': Welcome,
  'auth/sign-up': SignUp,
  'auth/sign-in': SignIn,
  'auth/forgot-password': ForgotPassword,
  'dev/gallery': GalleryScreen,
  'scenario/[name]': ScenarioRoute,
};

async function fill(email: string, password?: string) {
  fireEvent.changeText(await screen.findByTestId('auth-email'), email);
  if (password !== undefined) fireEvent.changeText(screen.getByTestId('auth-password'), password);
}

describe('auth gate', () => {
  it('opens straight to Trips when a session is stored', async () => {
    resetFakeAuth(testSession);
    const router = renderRouter(routes, { initialUrl: '/' });
    expect(await screen.findByRole('header', { name: 'My Trips' })).toBeOnTheScreen();
    expect(router.getPathname()).toBe('/trips');
  });

  it('shows Welcome when signed out, even for a link into the tabs', async () => {
    resetFakeAuth(null);
    const router = renderRouter(routes, { initialUrl: '/trips' });
    expect(await screen.findByRole('header', { name: 'Trip' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Continue with email' })).toBeOnTheScreen();
    expect(router.getPathname()).toBe('/auth');
  });

  it('keeps developer screens reachable when signed out', async () => {
    resetFakeAuth(null);
    const router = renderRouter(routes, { initialUrl: '/dev/gallery' });
    expect(await screen.findByText('My Trips')).toBeOnTheScreen();
    expect(router.getPathname()).toBe('/dev/gallery');
    await act(async () => {});
  });

  it('lets a scenario link into the tabs while signed out, and back to Welcome on exit', async () => {
    resetFakeAuth(null);
    const router = renderRouter(routes, { initialUrl: '/scenario/empty-account' });
    expect(await screen.findByRole('header', { name: 'My Trips' })).toBeOnTheScreen();
    expect(router.getPathname()).toBe('/trips');

    act(() => exitScenario());
    expect(await screen.findByRole('button', { name: 'Continue with email' })).toBeOnTheScreen();
    expect(router.getPathname()).toBe('/auth');
  });

  it('signs up and lands on Trips', async () => {
    resetFakeAuth(null);
    const router = renderRouter(routes, { initialUrl: '/' });

    fireEvent.press(await screen.findByRole('button', { name: 'Continue with email' }));
    expect(await screen.findByRole('header', { name: 'Create your account' })).toBeOnTheScreen();

    fireEvent.press(screen.getByTestId('auth-submit'));
    expect(screen.getByTestId('auth-email-error')).toHaveTextContent('Enter your email.');
    expect(screen.getByTestId('auth-password-error')).toHaveTextContent('Enter your password.');

    await fill('New@Example.com', 'short');
    fireEvent.press(screen.getByTestId('auth-submit'));
    expect(screen.getByTestId('auth-password-error')).toHaveTextContent(
      'Use at least 8 characters.',
    );
    expect(fakeAuth.signUp).not.toHaveBeenCalled();

    await fill('New@Example.com', 'long enough');
    fireEvent.changeText(screen.getByTestId('auth-name'), 'Matthew');
    await act(async () => fireEvent.press(screen.getByTestId('auth-submit')));

    expect(fakeAuth.signUp).toHaveBeenCalledWith({
      email: 'new@example.com',
      password: 'long enough',
      options: { data: { name_prompt: 'saved' } },
    });
    expect(await screen.findByRole('header', { name: 'My Trips' })).toBeOnTheScreen();
    expect(router.getPathname()).toBe('/trips');
  });

  it('says when the email already has an account', async () => {
    resetFakeAuth(null);
    fakeAuth.signUp.mockResolvedValue({
      data: {},
      error: new AuthApiError('User already registered', 422, 'user_already_exists'),
    } as never);
    renderRouter(routes, { initialUrl: '/auth/sign-up' });

    await fill('taken@example.com', 'long enough');
    fireEvent.changeText(screen.getByTestId('auth-name'), 'Matthew');
    await act(async () => fireEvent.press(await screen.findByTestId('auth-submit')));
    expect(screen.getByTestId('auth-form-error')).toHaveTextContent(
      'There is already an account with this email. Sign in instead.',
    );
  });

  it('shows a wrong password in plain words, then an offline retry message', async () => {
    resetFakeAuth(null);
    fakeAuth.signInWithPassword.mockResolvedValueOnce({
      data: {},
      error: new AuthApiError('Invalid login credentials', 400, 'invalid_credentials'),
    } as never);
    const router = renderRouter(routes, { initialUrl: '/auth/sign-in' });

    await fill('me@example.com', 'wrong password');
    await act(async () => fireEvent.press(await screen.findByTestId('auth-submit')));
    expect(screen.getByTestId('auth-form-error')).toHaveTextContent(
      "That password doesn't match this email.",
    );

    fakeAuth.signInWithPassword.mockRejectedValueOnce(
      new AuthRetryableFetchError('Failed to fetch', 0),
    );
    await act(async () => fireEvent.press(screen.getByTestId('auth-submit')));
    expect(screen.getByTestId('auth-form-error')).toHaveTextContent(
      "You're offline. Check your connection and try again.",
    );
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled();

    await act(async () => fireEvent.press(screen.getByTestId('auth-submit')));
    await waitFor(() => expect(router.getPathname()).toBe('/trips'));
  });

  it('shows progress on the button while signing in', async () => {
    resetFakeAuth(null);
    let finish: () => void = () => {};
    fakeAuth.signInWithPassword.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = () =>
            resolve({ data: { session: testSession, user: testSession.user }, error: null });
        }),
    );
    renderRouter(routes, { initialUrl: '/auth/sign-in' });

    await fill('me@example.com', 'secret');
    fireEvent.press(await screen.findByTestId('auth-submit'));
    expect(screen.getByRole('button', { name: 'Signing in…' })).toBeDisabled();
    fireEvent.press(screen.getByTestId('auth-submit'));
    expect(fakeAuth.signInWithPassword).toHaveBeenCalledTimes(1);
    await act(async () => finish());
  });

  it('sends a reset email from Forgot password', async () => {
    resetFakeAuth(null);
    renderRouter(routes, { initialUrl: '/auth/sign-in' });

    fireEvent.press(await screen.findByRole('button', { name: 'Forgot password?' }));
    expect(await screen.findByRole('header', { name: 'Reset password' })).toBeOnTheScreen();

    await fill(' Me@Example.com ');
    await act(async () => fireEvent.press(screen.getByTestId('auth-submit')));
    expect(fakeAuth.resetPasswordForEmail).toHaveBeenCalledWith('me@example.com', {
      // expo-router's test renderer stubs the scheme; the app uses trip:// (exp:// in Expo Go).
      redirectTo: expect.stringMatching(/:\/\/auth\/reset$/),
    });
    expect(screen.getByRole('header', { name: 'Check your email' })).toBeOnTheScreen();
    expect(screen.getByText(/me@example\.com/)).toBeOnTheScreen();
  });

  it('switches between sign-up and sign-in', async () => {
    resetFakeAuth(null);
    const router = renderRouter(routes, { initialUrl: '/auth/sign-up' });
    fireEvent.press(await screen.findByRole('button', { name: 'Sign in' }));
    expect(router.getPathname()).toBe('/auth/sign-in');
    fireEvent.press(await screen.findByRole('button', { name: 'Create an account' }));
    expect(router.getPathname()).toBe('/auth/sign-up');
  });

  it('returns to Welcome on sign-out', async () => {
    resetFakeAuth(testSession);
    const router = renderRouter(routes, { initialUrl: '/' });
    expect(await screen.findByRole('header', { name: 'My Trips' })).toBeOnTheScreen();

    act(() => emitAuthChange('SIGNED_OUT', null));
    expect(await screen.findByRole('button', { name: 'Continue with email' })).toBeOnTheScreen();
    expect(router.getPathname()).toBe('/auth');
  });
});
