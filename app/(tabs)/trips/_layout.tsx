import { Stack } from 'expo-router/stack';

export default function Layout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen
        name="new"
        options={{ presentation: 'modal', headerShown: true, title: 'New Trip' }}
      />
    </Stack>
  );
}
