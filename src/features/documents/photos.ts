import { useQuery } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { ActionSheetIOS } from 'react-native';

import { queryClient } from '@/services/data';

/**
 * Document photos (TR-20). An account's photos live in the private `originals` bucket under
 * `<uid>/documents/`, which RLS limits to their owner; screens show them through short-lived
 * signed URLs. A demo session keeps the picked file's local URI and never uploads. Nothing here
 * calls an AI service (ADR 0004; enforced by `noAi.test.ts`).
 */

const BUCKET = 'originals';
const SIGNED_URL_SECONDS = 60 * 60;

/** Required on first use, so demo sessions and tests never create a Supabase client. */
const client = (): (typeof import('@/services/supabase'))['supabase'] =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@/services/supabase').supabase;

/** A photo still on the phone (just picked), as opposed to a Storage path. */
export function isLocalUri(path: string): boolean {
  return /^[a-z][a-z0-9+.-]*:/i.test(path);
}

function contentType(uri: string): { type: string; ext: string } {
  const ext = uri.split('?')[0].split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'png') return { type: 'image/png', ext };
  if (ext === 'heic') return { type: 'image/heic', ext };
  return { type: 'image/jpeg', ext: 'jpg' };
}

/** Uploads a picked photo under the signed-in user's folder and returns its Storage path. */
export async function uploadDocumentPhoto(uri: string): Promise<string> {
  const supabase = client();
  const { data, error } = await supabase.auth.getSession();
  const uid = data.session?.user.id;
  if (error || !uid) throw new Error(error?.message ?? 'Not signed in');
  const { type, ext } = contentType(uri);
  const path = `${uid}/documents/${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const body = await (await fetch(uri)).arrayBuffer();
  const upload = await supabase.storage.from(BUCKET).upload(path, body, { contentType: type });
  if (upload.error) throw new Error(upload.error.message);
  return path;
}

export async function removeDocumentPhotos(paths: readonly string[]): Promise<void> {
  const stored = paths.filter((p) => !isLocalUri(p));
  if (stored.length === 0) return;
  const { error } = await client().storage.from(BUCKET).remove(stored);
  if (error) throw new Error(error.message);
}

/** Something an Image can show: the local URI as is, or a signed URL for a Storage path. */
export function usePhotoUri(path: string): string | null {
  const local = isLocalUri(path);
  const signed = useQuery(
    {
      queryKey: ['document-photo', path],
      queryFn: async () => {
        const { data, error } = await client()
          .storage.from(BUCKET)
          .createSignedUrl(path, SIGNED_URL_SECONDS);
        if (error) throw new Error(error.message);
        return data.signedUrl;
      },
      enabled: !local,
      // Refetch well before the signed URL runs out.
      staleTime: (SIGNED_URL_SECONDS / 2) * 1000,
    },
    queryClient,
  );
  return local ? path : (signed.data ?? null);
}

/**
 * Asks where the photo comes from (native action sheet), then opens the camera or the photo
 * library. Resolves to the picked photos' local URIs; empty when cancelled or not allowed.
 */
export function pickDocumentPhotos(): Promise<string[]> {
  return new Promise((resolve) => {
    ActionSheetIOS.showActionSheetWithOptions(
      { options: ['Take Photo', 'Choose from Library', 'Cancel'], cancelButtonIndex: 2 },
      (index) => {
        if (index === 0) void fromCamera().then(resolve, () => resolve([]));
        else if (index === 1) void fromLibrary().then(resolve, () => resolve([]));
        else resolve([]);
      },
    );
  });
}

const OPTIONS: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.8 };

async function fromCamera(): Promise<string[]> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) return [];
  const result = await ImagePicker.launchCameraAsync(OPTIONS);
  return result.canceled ? [] : result.assets.map((a) => a.uri);
}

async function fromLibrary(): Promise<string[]> {
  const result = await ImagePicker.launchImageLibraryAsync({
    ...OPTIONS,
    allowsMultipleSelection: true,
    selectionLimit: 4,
  });
  return result.canceled ? [] : result.assets.map((a) => a.uri);
}
