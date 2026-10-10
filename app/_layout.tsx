import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { DarkTheme, ThemeProvider } from 'expo-router';
import { Stack } from 'expo-router/stack';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AuthProvider, useAuth, useReturnToInvite } from '@/features/auth';
import { NamePrompt } from '@/features/settings';
import { useScenarioActive } from '@/scenarios';
import { colors } from '@/theme';

// Keep the splash screen up until the stored session has been read, so a signed-in user never sees
// Welcome flash past.
SplashScreen.preventAutoHideAsync().catch(() => {});

const theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: colors.accent,
    background: colors.background,
    card: colors.background,
    text: colors.textPrimary,
    border: colors.hairline,
  },
};

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <ThemeProvider value={theme}>
        <AuthProvider>
          <BottomSheetModalProvider>
            <StatusBar style="light" />
            <RootStack />
          </BottomSheetModalProvider>
        </AuthProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

/**
 * The auth gate: signed-in users get the tabs and Settings, signed-out users get Welcome. A loaded scenario's
 * demo session (TR-6) also opens the tabs, so QA links work signed out. Developer screens (`/dev/*`),
 * scenario links (`/scenario/*`) and invite links (`/invite/*`, TR-57) are outside both guards; an
 * invite opened signed out is reopened once the traveller has signed in or signed up.
 */
function RootStack() {
  const auth = useAuth();
  const scenarioActive = useScenarioActive();
  const signedIn = auth.status === 'signedIn';
  useReturnToInvite(signedIn);

  useEffect(() => {
    if (auth.status !== 'loading') SplashScreen.hideAsync().catch(() => {});
  }, [auth.status]);

  // Mount the navigator only once the guards are known: a deep link opened at launch (a tab, a
  // scenario) then resolves against the real session instead of being bounced while it loads.
  if (auth.status === 'loading') return null;

  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={signedIn || scenarioActive}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="settings" />
        </Stack.Protected>
        <Stack.Protected guard={!signedIn && !scenarioActive}>
          <Stack.Screen name="auth" />
        </Stack.Protected>
        <Stack.Screen
          name="dev/gallery"
          options={{ headerShown: true, title: 'Gallery', headerBackTitle: 'Trips' }}
        />
        <Stack.Screen
          name="dev/push"
          options={{ headerShown: true, title: 'Push test', headerBackTitle: 'Developer' }}
        />
      </Stack>
      {/* The one-time "What should friends call you?" sheet (TR-55). */}
      <NamePrompt />
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
});
