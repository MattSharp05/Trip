// Jest stand-in for expo-notifications: tests set the permission and token, and deliver pushes.
type Listener = (notification: unknown) => void;
const listeners = new Set<Listener>();

export const getPermissionsAsync = jest.fn(async () => ({
  status: 'undetermined',
  granted: false,
}));
export const requestPermissionsAsync = jest.fn(async () => ({ status: 'granted', granted: true }));
export const getExpoPushTokenAsync = jest.fn(async () => ({
  type: 'expo',
  data: 'ExponentPushToken[test-token]',
}));
export const setNotificationHandler = jest.fn();
export const useLastNotificationResponse = jest.fn(() => undefined);
export const addNotificationReceivedListener = jest.fn((listener: Listener) => {
  listeners.add(listener);
  return { remove: () => listeners.delete(listener) };
});

/** Test helper: deliver a notification to every received-listener, as if a push arrived. */
export function deliver(notification: unknown) {
  listeners.forEach((listener) => listener(notification));
}
