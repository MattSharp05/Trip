import { Asset } from 'expo-asset';
// The legacy API: expo-calendar's newer one is a stub in Expo Go.
import * as Calendar from 'expo-calendar/legacy';
import * as ImagePicker from 'expo-image-picker';
import * as Sharing from 'expo-sharing';
import { Linking } from 'react-native';

import type { FlightData, PassImage } from '@/services/data/types';
import { originalUrl } from '@/services/originals';

import { flightCalendarEvent } from './flightInfo';
import { fixtureModule } from './passImages';

/**
 * Opens iOS's own "New Event" sheet filled in with the flight. The user confirms there, so the app
 * never needs access to their calendars. True when they saved it.
 */
export async function addFlightToCalendar(flight: FlightData): Promise<boolean> {
  const result = await Calendar.createEventInCalendarAsync(flightCalendarEvent(flight));
  return result.action === 'saved';
}

/**
 * Opens the booking's original file: a bundled sample goes to the share sheet (Quick Look, Save to
 * Files), an imported one opens from Storage through a short-lived link.
 */
export async function openOriginal(path: string): Promise<void> {
  const fixture = fixtureModule(path);
  if (fixture === undefined) {
    await Linking.openURL(await originalUrl(path));
    return;
  }
  const [asset] = await Asset.loadAsync(fixture);
  await Sharing.shareAsync(asset.localUri ?? asset.uri, { dialogTitle: 'Original booking' });
}

/** Lets the user pick a photo or screenshot of their boarding pass; null if they cancel. */
export async function pickPassImage(): Promise<PassImage | null> {
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
  const picked = result.canceled ? undefined : result.assets[0];
  return picked ? { uri: picked.uri, width: picked.width, height: picked.height } : null;
}
