import * as SecureStore from 'expo-secure-store';

// SecureStore warns above 2048 bytes per value and a Supabase session (two JWTs plus the user) is
// bigger, so each value is split into chunks under `<key>.<i>` with the chunk count at `<key>`.
// 600 UTF-16 units stay under 2048 bytes even if every character takes 3 bytes in UTF-8.
const CHUNK_SIZE = 600;

// SecureStore keys allow only [A-Za-z0-9._-]; supabase-js uses keys like `sb-<ref>-auth-token`.
function safeKey(key: string): string {
  return key.replace(/[^A-Za-z0-9._-]/g, '_');
}

async function removeChunks(key: string): Promise<void> {
  const count = Number((await SecureStore.getItemAsync(key)) ?? 0);
  for (let i = 0; i < count; i += 1) {
    await SecureStore.deleteItemAsync(`${key}.${i}`);
  }
  await SecureStore.deleteItemAsync(key);
}

/** A supabase-js `auth.storage` adapter backed by the iOS Keychain. */
export const secureStorage = {
  async getItem(name: string): Promise<string | null> {
    const key = safeKey(name);
    const count = await SecureStore.getItemAsync(key);
    if (count === null) return null;
    const chunks: string[] = [];
    for (let i = 0; i < Number(count); i += 1) {
      const chunk = await SecureStore.getItemAsync(`${key}.${i}`);
      if (chunk === null) return null;
      chunks.push(chunk);
    }
    return chunks.join('');
  },

  async setItem(name: string, value: string): Promise<void> {
    const key = safeKey(name);
    await removeChunks(key);
    const count = Math.ceil(value.length / CHUNK_SIZE);
    for (let i = 0; i < count; i += 1) {
      await SecureStore.setItemAsync(
        `${key}.${i}`,
        value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE),
      );
    }
    await SecureStore.setItemAsync(key, String(count));
  },

  async removeItem(name: string): Promise<void> {
    await removeChunks(safeKey(name));
  },
};
