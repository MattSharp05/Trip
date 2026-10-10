# 0032 — Payment reminders: in-app first, phone push only if Expo Go allows it

Status: **Proposed** (decided by the push spike ticket).

**Context.** Decision 6 (PRD v2): reminders start as an in-app nudge; spike whether remote push
works in Expo Go on iOS before promising it. Expo removed push from Expo Go on Android (SDK 53);
the iOS situation in SDK 57 must be checked on Matthew's iPhone, not assumed. `expo-notifications`
is a bundled SDK module, so it passes the Expo Go dependency test (ADR 0001); the Expo Push
service (`exp.host`) is free and reachable from the cloud.

**Decision (default until the spike says otherwise).**
- A reminder is a `payment_nudges (trip_id, from_user, to_user, amount_minor, currency,
  created_at, seen_at)` row, at most one per pair per day (enforced in the insert policy). The
  recipient sees a calm banner in Trip ("Willem sent a reminder: you owe $7.00 · Settle up") the
  next time the app is open, live via Realtime (ADR 0028).
- Spike: on Matthew's iPhone in Expo Go, request permission, get an Expo push token
  (`getExpoPushTokenAsync({ projectId })`) and receive a push sent to `exp.host`. Pass → a
  follow-up adds `push_tokens` and an Edge Function `notify` that sends a push with the nudge.
  Fail → in-app only until Phase B.

**Consequences.** Reminders never depend on push; push is an addition.

**Spike build (TR-52).** Settings → Developer → Push test (`app/dev/push.tsx`) asks permission,
shows the Expo push token (`getExpoPushTokenAsync({ projectId })`, or the exact error), and "Send
test push" posts one push to the Expo Push API (`src/services/expoPush.ts`) 5 seconds after the tap,
so there is time to lock the phone. The screen then shows when it was sent (and whether the app was
already in the background), whether a push arrived with the app open, and whether Trip was opened
from the push.

## Result

Pending Matthew's device check (TR-52 QA, iPhone, Expo Go on the latest `main`). What each outcome
means:
- **Works:** a token appears and the push shows on the lock screen. Push is promised for payment
  reminders: a follow-up ticket adds a `push_tokens (user_id, token, updated_at)` table (RLS: own
  rows) and an Edge Function `notify` that sends the nudge's push through `exp.host` when a
  `payment_nudges` row is inserted. The in-app banner stays as the baseline. This ADR becomes
  Accepted.
- **Partially:** a token appears but the push only shows with the app open, or only sometimes. Treat
  as not working for reminders (in-app only until Phase B); record the exact behaviour here.
- **Doesn't work:** no token (the error on screen is recorded here) or no push arrives. Reminders
  are in-app only until Phase B, when a development build on the company's Apple account brings
  real push. This ADR becomes Accepted with "in-app only".
