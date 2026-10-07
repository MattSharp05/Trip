#!/usr/bin/env node
// Copies third-party API keys from the environment into Supabase Edge Function secrets through the
// Management API, so they never ship in the app (TDD → Environments & deploy). Only the names below
// are sent, and only when set; values are never printed.
//
//   SUPABASE_ACCESS_TOKEN=… UNSPLASH_ACCESS_KEY=… GEMINI_API_KEY=… node scripts/supabase-secrets.mjs

import { api } from './supabase-api.mjs';

const NAMES = ['UNSPLASH_ACCESS_KEY', 'GEMINI_API_KEY'];

try {
  const secrets = NAMES.filter((name) => process.env[name]).map((name) => ({
    name,
    value: process.env[name],
  }));
  if (secrets.length === 0) {
    console.error(`None of ${NAMES.join(', ')} is set; nothing to store.`);
    process.exit(1);
  }
  await api('POST', '/secrets', secrets);
  console.log(`stored: ${secrets.map((s) => s.name).join(', ')}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
