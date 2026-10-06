import { secureStorage } from './secureStorage';

const mockStore = new Map<string, string>();

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async (key: string) => mockStore.get(key) ?? null),
  setItemAsync: jest.fn(async (key: string, value: string) => {
    if (!/^[A-Za-z0-9._-]+$/.test(key)) throw new Error(`invalid key ${key}`);
    if (Buffer.byteLength(value) > 2048) throw new Error('value too large');
    mockStore.set(key, value);
  }),
  deleteItemAsync: jest.fn(async (key: string) => {
    mockStore.delete(key);
  }),
}));

beforeEach(() => mockStore.clear());

describe('secureStorage', () => {
  it('returns null for a missing key', async () => {
    expect(await secureStorage.getItem('sb-ref-auth-token')).toBeNull();
  });

  it('round-trips a session larger than one SecureStore value', async () => {
    const session = JSON.stringify({
      access_token: 'a'.repeat(3000),
      refresh_token: 'r'.repeat(900),
    });
    await secureStorage.setItem('sb-ref-auth-token', session);
    expect(await secureStorage.getItem('sb-ref-auth-token')).toBe(session);
    expect(mockStore.size).toBe(1 + Math.ceil(session.length / 600)); // count + chunks
  });

  it('keeps every chunk under 2048 bytes for multi-byte text', async () => {
    const name = '日本語のユーザー名'.repeat(300);
    await secureStorage.setItem('k', name);
    expect(await secureStorage.getItem('k')).toBe(name);
  });

  it('drops leftover chunks when a shorter value replaces a longer one', async () => {
    await secureStorage.setItem('k', 'x'.repeat(5000));
    await secureStorage.setItem('k', 'short');
    expect(await secureStorage.getItem('k')).toBe('short');
    expect([...mockStore.keys()].sort()).toEqual(['k', 'k.0']);
  });

  it('removes every chunk', async () => {
    await secureStorage.setItem('k', 'x'.repeat(5000));
    await secureStorage.removeItem('k');
    expect(mockStore.size).toBe(0);
    expect(await secureStorage.getItem('k')).toBeNull();
  });

  it('maps keys SecureStore would reject to safe ones', async () => {
    await secureStorage.setItem('sb:ref/auth token', 'v');
    expect(await secureStorage.getItem('sb:ref/auth token')).toBe('v');
  });
});
