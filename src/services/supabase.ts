import 'react-native-url-polyfill/auto';

import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import { AppState } from 'react-native';

import type { Database } from './database.types';
import { secureStorage } from './secureStorage';

type SupabaseExtra = { supabaseUrl?: string; supabaseAnonKey?: string };

// The URL and anon key are public by design (RLS guards the data); they live in app.json `extra`.
// EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY override them, e.g. for another project.
export function supabaseConfig(
  env: Record<string, string | undefined> = {
    EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
    EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  },
  extra: SupabaseExtra = (Constants.expoConfig?.extra ?? {}) as SupabaseExtra,
): { url: string; anonKey: string } {
  const url = env.EXPO_PUBLIC_SUPABASE_URL || extra.supabaseUrl;
  const anonKey = env.EXPO_PUBLIC_SUPABASE_ANON_KEY || extra.supabaseAnonKey;
  if (!url || !anonKey) {
    throw new Error('Supabase URL and anon key are missing from app.json extra.');
  }
  return { url, anonKey };
}

const { url, anonKey } = supabaseConfig();

export const supabase = createClient<Database>(url, anonKey, {
  auth: {
    storage: secureStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Refresh tokens only while the app is in the foreground (supabase-js guidance for React Native).
AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});
