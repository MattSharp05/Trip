import appJson from '../../app.json';
import { supabase, supabaseConfig } from './supabase';

jest.mock('expo-constants', () => ({
  expoConfig: { extra: jest.requireActual('../../app.json').expo.extra },
}));
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
  deleteItemAsync: jest.fn(async () => undefined),
}));

describe('supabaseConfig', () => {
  const extra = { supabaseUrl: 'https://app.supabase.co', supabaseAnonKey: 'app-key' };

  it('reads the URL and anon key from app.json extra', () => {
    expect(supabaseConfig({}, extra)).toEqual({
      url: 'https://app.supabase.co',
      anonKey: 'app-key',
    });
  });

  it('lets EXPO_PUBLIC_ variables override app.json', () => {
    const env = {
      EXPO_PUBLIC_SUPABASE_URL: 'https://other.supabase.co',
      EXPO_PUBLIC_SUPABASE_ANON_KEY: 'other-key',
    };
    expect(supabaseConfig(env, extra)).toEqual({
      url: 'https://other.supabase.co',
      anonKey: 'other-key',
    });
  });

  it('fails loudly when nothing is configured', () => {
    expect(() => supabaseConfig({}, {})).toThrow(/anon key/);
  });

  it('ships the project URL and an anon (not service-role) key in app.json', () => {
    const { supabaseUrl, supabaseAnonKey } = appJson.expo.extra;
    expect(supabaseUrl).toBe('https://wghftsubdrkxfzysovou.supabase.co');
    const payload = JSON.parse(Buffer.from(supabaseAnonKey.split('.')[1], 'base64url').toString());
    expect(payload).toMatchObject({ role: 'anon', ref: 'wghftsubdrkxfzysovou' });
  });
});

describe('supabase client', () => {
  it('is created from app config', () => {
    expect(supabase.auth).toBeDefined();
    expect(typeof supabase.from).toBe('function');
  });
});
