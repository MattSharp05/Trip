import { Stack } from 'expo-router/stack';

import { colors } from '@/theme';

export default function SettingsLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerTintColor: colors.accent,
        headerTitleStyle: { color: colors.textPrimary },
        headerStyle: { backgroundColor: colors.background },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen
        name="index"
        options={{ title: 'Settings', headerLargeTitle: true, headerBackTitle: 'Trips' }}
      />
      <Stack.Screen name="profile" options={{ title: 'Name' }} />
      <Stack.Screen name="payment" options={{ title: 'Payment Info' }} />
      <Stack.Screen name="currency" options={{ title: 'Home Currency' }} />
      <Stack.Screen name="terms" options={{ title: 'Terms of Use' }} />
      <Stack.Screen name="privacy" options={{ title: 'Privacy' }} />
    </Stack>
  );
}
