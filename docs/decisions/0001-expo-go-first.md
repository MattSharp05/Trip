# 0001 — Expo, running in Expo Go during the demo phase

**Context.** The PRD needs an iPhone app with iPhone-only extras later (share sheet, widgets, Live
Activities), but the demo phase must cost $0: no paid Apple developer account and no Mac. Claude
builds in Linux cloud sessions.

**Decision.** Expo (React Native + TypeScript, SDK 57). Until Phase B, use only libraries included in
Expo Go and no custom native code. Delivery is EAS Update to the `main` channel, opened in Expo Go.

**Consequences.**
- Matthew tests on his own phone for free; no TestFlight until Phase B.
- Excluded until Phase B: share extension, widgets, Live Activities, Apple Wallet, Sign in with
  Apple, `@rnmapbox/maps`, `maplibre-react-native`, `expo-maps`.
- Phase B adds a development build on the company account; the code stays the same.
- Expo Go only runs the latest SDK, so SDK upgrades are planned tickets.
