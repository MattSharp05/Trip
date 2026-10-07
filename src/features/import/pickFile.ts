import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';

import type { PickedFile } from '@/services/parseBooking';

/** A booking PDF from Files (iCloud Drive, Downloads, Mail attachments saved there). */
export async function pickPdf(): Promise<PickedFile | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: 'application/pdf',
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled || !result.assets[0]) return null;
  const asset = result.assets[0];
  return { uri: asset.uri, name: asset.name, mimeType: asset.mimeType ?? 'application/pdf' };
}

/** A screenshot of a booking from the photo library. */
export async function pickScreenshot(): Promise<PickedFile | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.9,
  });
  if (result.canceled || !result.assets[0]) return null;
  const asset = result.assets[0];
  const fromUri = asset.uri.split('/').pop() ?? 'screenshot.jpg';
  return {
    uri: asset.uri,
    name: asset.fileName ?? fromUri,
    mimeType:
      asset.mimeType ?? (fromUri.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg'),
  };
}
