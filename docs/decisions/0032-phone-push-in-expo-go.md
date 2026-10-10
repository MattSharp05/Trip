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
