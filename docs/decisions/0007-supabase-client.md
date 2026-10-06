# 0007 — Supabase client libraries and session storage

**Context.** TR-4 adds the app's Supabase client (ADR 0003). It has to run in Expo Go (ADR 0001)
and keep the signed-in session across launches. A Supabase session (two JWTs plus the user) is
larger than the 2048 bytes `expo-secure-store` accepts per value.

**Decision.**
- `@supabase/supabase-js` as the client, typed with `src/services/database.types.ts` generated from
  the Management API types endpoint.
- `expo-secure-store` (bundled in Expo Go) for the session, through a small adapter that splits each
  value into chunks of at most 2048 bytes (`src/services/secureStorage.ts`). The Keychain keeps
  tokens out of plain AsyncStorage without adding an encryption library.
- `react-native-url-polyfill` (pure JS), the polyfill Expo's Supabase guide uses, so supabase-js
  gets a full `URL`/`URLSearchParams` on Hermes.
- The project URL and anon key live in `app.json` `extra` (public by design; RLS guards the data),
  overridable with `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY`.

**Consequences.**
- No native code outside Expo Go; the Expo Go dependency test stays green.
- A few Keychain reads per session restore instead of one; negligible.
- Phase B can keep the same adapter.
