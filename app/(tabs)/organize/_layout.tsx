import { Stack } from 'expo-router/stack';

// Opening a booking from another tab (the Plan tab's flight card) keeps Organize under it, so Back
// leads somewhere.
export const unstable_settings = { initialRouteName: 'index' };

export default function Layout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
