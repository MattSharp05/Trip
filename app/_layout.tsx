import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { DarkTheme, ThemeProvider } from 'expo-router';
import { Stack } from 'expo-router/stack';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AuthProvider, useAuth } from '@/features/auth';
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
 * The auth gate: signed-in users get the tabs, signed-out users get Welcome. Developer screens
 * (`/dev/*`) and scenario links (`/scenario/*`, TR-6) are outside both guards so QA links open
 * either way.
 */
function RootStack() {
  const auth = useAuth();
  const signedIn = auth.status === 'signedIn';

  useEffect(() => {
    if (auth.status !== 'loading') SplashScreen.hideAsync().catch(() => {});
  }, [auth.status]);

  // Mount the navigator only once the guards are known: a deep link opened at launch (a tab, a
  // scenario) then resolves against the real session instead of being bounced while it loads.
  if (auth.status === 'loading') return null;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="(tabs)" />
      </Stack.Protected>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="auth" />
      </Stack.Protected>
      <Stack.Screen
        name="dev/gallery"
        options={{ headerShown: true, title: 'Gallery', headerBackTitle: 'Trips' }}
      />
      <Stack.Screen
        name="dev/map-spike"
        options={{ headerShown: true, title: 'Map spike', headerBackTitle: 'Trips' }}
      />
    </Stack>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
});
