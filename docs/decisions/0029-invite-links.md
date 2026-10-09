# 0029 — Invite links and joining

**Context.** Decision 1 (PRD v2): joining is an invite link shared from the app; each friend needs
a Trip account and, during the demo phase, Expo Go. There is no website or associated domain.

**Decision.**
- `trip_invites (token text primary key, trip_id, created_by, created_at, revoked_at)`. The token is
  22 random URL-safe characters. One active link per trip; "Reset link" revokes it and makes a new
  one. No expiry in the demo (assumption, PRD).
- Two `security definer` RPCs, granted to `authenticated` only:
  `invite_preview(token)` → trip city, dates, cover, inviter's display name and member count (no
  other trip data); `accept_invite(token)` → inserts a `member` row (idempotent) and returns the
  trip id. Revoked or unknown tokens return a "this invite link is no longer active" error.
- Link format: during the demo, the Expo Go link
  `exp://u.expo.dev/<project-id>/--/invite/<token>?runtime-version=exposdk:57.0.0&channel-name=main`
  (built in one helper next to `src/scenarios/link.ts`), and `trip://invite/<token>` once there is
  a standalone build. The app shares it with React Native's `Share` API (the iOS share sheet; no
  new dependency).
- Route `app/invite/[token].tsx` sits outside the signed-in guard. Signed out: it stores the token
  and sends the person to sign up / sign in, then back to the invite. Signed in: preview → Join →
  `accept_invite` → select the trip → Plan (map).

**Consequences.**
- Anyone with the link can join until it's reset; fine for friends, revisit for Phase B.
- Expo Go links only open on phones with Expo Go installed (Phase B standalone builds fix this).
