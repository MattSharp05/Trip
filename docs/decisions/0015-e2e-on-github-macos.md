# 0015 — On-device flows: EAS simulator build, Maestro on GitHub's macOS runner

**Context.** ADR 0005 puts Maestro flows on an EAS iOS simulator build, run on `main`. TR-8 had
two ways to do it: an EAS Workflow (fingerprint → reuse or build → EAS's `maestro` job), or a
GitHub Actions job. Starting the EAS Workflow on the free plan fails before it runs: "Running
maestro_test jobs requires a paid plan" (2026-10-06). The repo is public, so GitHub's macOS
runners cost nothing.

**Decision.**
- EAS Build makes the simulator app (`eas.json` profile `e2e`: simulator, not a dev client,
  scenarios on). It is reused while the iOS fingerprint (`eas fingerprint:generate`) matches a
  finished `e2e` build. A native change (new dependency, app config) costs one build from the
  free monthly quota.
- On a reused build, `@expo/repack-app` puts the current JS bundle into it on the runner, so the
  flows always test the pushed commit without a native build.
- `.github/workflows/e2e.yml` runs on every push to `main` and by hand (`workflow_dispatch`),
  never on PRs. It is a separate workflow, so it never blocks CI or the EAS Update job. Runs queue
  one at a time instead of cancelling, so an EAS build started by one run is reused by the next.
- Flows: `maestro/smoke.yaml`, every file in `maestro/shots/` (one per scenario, through
  `maestro/scenario.yaml`), and feature flows such as `maestro/plan-linking.yaml`. Their
  defaults target the simulator build (`com.mattsharp05.trip`, `trip://` links); `-e` overrides
  run them in Expo Go.
- Screenshots go to the run's `e2e-screenshots` artifact; `node scripts/qa-shots.mjs` downloads
  the latest one for ticket write-ups.

**Consequences.**
- CI logic stays in GitHub Actions, next to `ci.yml`; Expo is only used to build.
- The app gets an iOS bundle identifier, `com.mattsharp05.trip`. Phase B may change it for the
  company's Apple account; that is a native change (one new e2e build).
- If the repo goes private, macOS minutes count 10× against GitHub's free minutes: switch the job
  to `workflow_dispatch` only, or move to a paid Expo plan and EAS's `maestro` job.
- Measured on the branch (2026-10-07): a run that reuses the build takes ~13–19 min (simulator
  boot 5–8 min, flows ~3 min); a run with a new fingerprint ~22 min (EAS build ~9 min, including
  the free plan's queue). Both stay under the 30-minute limit for running on every push.
- iOS asks "Open in Trip?" for `trip://` links: flows open links through `maestro/open-link.yaml`,
  which accepts it (and retries the link once a slow simulator times out).
- TR-40 (2026-10-09): the prompt shows once per install and can take 10 s+ to appear on the
  runner, and a link requested while it is up is usually lost. `maestro/warm-up.yaml` runs first in
  its own `maestro test` (driver start, first launch, accepts the prompt); open-link.yaml opens
  the link again after accepting; smoke clears the keychain instead of `clearState` (which
  reinstalls the app on iOS and brings the prompt back). One broken flow early in the run used to
  take the XCTest driver down with it, failing every later flow in seconds.
